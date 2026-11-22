/**
 * #1 Boot-/render-röktest (jsdom).
 *
 * De rena kärnorna (stat/trend/forecast/structure/likvardighet) är vältestade och
 * drift-skyddade. Det som SAKNADE automatiskt skydd var render-, export- och
 * boot-koden i app.js — den verifierades bara manuellt i webbläsare. Detta test
 * laddar index.html + app.js i jsdom, stubbar de tunga biblioteken (XLSX/
 * PapaParse/JSZip) och kör hela boot-pipelinen + varje fliks render-funktion.
 * Det fångar exakt den regressionsklass som t.ex. en död-kod-städning kan införa
 * (kastande render, trasig wiring) utan att kräva en riktig webbläsare.
 *
 * Det är ett RÖKTEST, inte ett pixel-/innehållstest: assertionen är "renderar utan
 * att kasta + förväntade element finns", inte exakta värden (det täcks av kärn-testerna).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';

let win;

beforeAll(() => {
    win = createAppWindow();
    win.__loadDemoData();   // blocken nedan läser demodatan
});

describe('#1 röktest: #8 metod-appendix + #5 rapportbyggare', () => {
    it('metod-appendix byggs och innehåller demo-flagga + modellspec', () => {
        const data = JSON.stringify(win.__methodAppendixData());
        expect(data).toContain('DEMODATA');          // #9 demoläge syns
        expect(data).toContain('HC3');                // modellspec finns
    });

    it('§3:10- och strukturmåtten kan beräknas på demodata', () => {
        expect(() => win.__computeLikvardighetPairs()).not.toThrow();
        expect(() => win.__stRepresentationByBas(win.__getData())).not.toThrow();
    });
});

describe('#export röktest: BAS-grupperade tabeller blir Word-block', () => {
    it('rapport-tabellen exporteras som block: titel + upprepade rubriker + tomrad per BAS', () => {
        // generateRapport har körts av demodata-pipelinen → rapport-table har group-headers
        const clone = win.__cloneTable('rapport-table');
        expect(clone).toBeTruthy();
        const g = win.__groupedAoa(clone);
        const headers = g.aoa[g.firstHeaderRowIdx];
        expect(headers.length).toBeGreaterThan(3);
        // Varje BAS-block: titelrad ("BAS X") direkt följd av kolumnrubriksrad
        const titleRows = g.aoa.map((r, i) => ({ r, i })).filter(x => x.r.length === 1 && /^BAS /.test(String(x.r[0])));
        expect(titleRows.length).toBeGreaterThan(1);                  // flera BAS-block
        titleRows.forEach(({ i }) => expect(g.aoa[i + 1]).toEqual(headers));   // rubriker upprepas
        // Tomrad mellan blocken (Word-markering): raden före varje titel utom första är tom
        titleRows.slice(1).forEach(({ i }) => expect(g.aoa[i - 1]).toEqual([]));
        // Merge-info för titelraderna finns (snygg titel över hela bredden i Excel)
        expect(g.merges.length).toBe(titleRows.length);
    });
});

describe('Word-utkast: dokumentationsskelett (§§ 8–14) på demodata', () => {
    const draft = () => win.__docDraftHtml();

    it('innehåller alla lagstegens rubriker i ordning', () => {
        const html = draft();
        // Rubrikerna är klarspråk utan paragraf (lagrummen står i docs/utveckling/lagrum.md) — men varje
        // lagsteg måste fortfarande finnas, i rätt ordning.
        const idxs = ['Regler och praxis kring lön', 'Lika arbete — kvinnor och män i samma AID-etikett och BAS-intervall', 'Likvärdigt arbete — kvinnodominerade AID-etiketter',
            'Åtgärder och tidsplan', 'Samverkan med arbetstagarna', 'Beslut och underskrift', 'Bilaga: Metod']
            .map(h => html.indexOf(h));
        idxs.forEach(i => expect(i).toBeGreaterThan(-1));        // alla finns
        const sorted = [...idxs].sort((a, b) => a - b);
        expect(idxs).toEqual(sorted);                            // i rätt ordning
    });

    it('har gula [HR fyller i]-block för de kvalitativa bedömningarna', () => {
        const html = draft();
        const count = (html.match(/\[HR fyller i\]/g) || []).length;
        expect(count).toBeGreaterThanOrEqual(6);                 // regler, lika, likvärdigt, åtgärder, samverkan, beslut, summering
        expect(html).toContain('class="fillin"');
    });

    it('fyller i verktygets fynd (antal anställda + metodbilaga)', () => {
        const html = draft();
        expect(html).toContain(String(win.__state.data.length));  // 200 demo-rader
        expect(html).toContain('HC3');                            // metodbilagan med
        expect(html).toContain('UTKAST');                         // tydlig utkast-märkning
    });

    it('märker demodata tydligt (exporten får aldrig förväxlas med verklig analys)', () => {
        expect(win.__state.isDemo).toBe(true);
        expect(draft()).toContain('DEMODATA');
    });
});

describe('§ 8-ställning: bedömning per område + flöde till Word-utkastet', () => {
    it('injicerar status + anteckning i alla 6 granskningsområden vid boot', () => {
        expect(win.document.querySelectorAll('[id^="bes8-status-"]').length).toBe(6);
        expect(win.document.querySelectorAll('[id^="bes8-note-"]').length).toBe(6);
        expect(win.document.querySelectorAll('.bes8-field').length).toBe(12);
    });

    it('Word-utkastets § 8-sektion listar områdena och får [HR fyller i] när tomt', () => {
        const html = win.__docDraftHtml();
        expect(html).toContain('Granskningsområde');                 // § 8-tabellrubrik
        expect(html).toContain('Lönesättningsprinciper');            // område 1-titel
        expect(html).toContain('Granskningsområde'); // (tabell, ej generisk fillin)
    });

    it('ifylld bedömning + anteckning följer med till Word-utkastet', () => {
        win.document.getElementById('bes8-status-1').value = 'Åtgärd krävs';
        win.document.getElementById('bes8-note-1').value = 'Kriterierna är inte dokumenterade.';
        const html = win.__docDraftHtml();
        expect(html).toContain('Åtgärd krävs');
        expect(html).toContain('Kriterierna är inte dokumenterade.');
        // städa upp så andra tester inte påverkas
        win.document.getElementById('bes8-status-1').value = '';
        win.document.getElementById('bes8-note-1').value = '';
    });
});

describe('handläggarstöd: gruppdossier, robusthet, färdigcheck', () => {
    it('dossier-kandidater respekterar k-anonymiteten', () => {
        win.__loadDemoData();
        const cands = win.__gruppdossierCandidates();
        expect(cands.length).toBeGreaterThan(0);
        cands.forEach(g => expect(g.rows.length).toBeGreaterThanOrEqual(10));
    });

    it('buildGruppdossier samlar blocken och tål saknade referenser', () => {
        const key = win.__gruppdossierCandidates()[0].key;
        const d = win.__buildGruppdossier(key);
        expect(d).not.toBeNull();
        expect(d.n).toBeGreaterThanOrEqual(10);
        expect(d.nKv + d.nMa).toBeLessThanOrEqual(d.n);
        expect(Number.isFinite(d.median)).toBe(true);
        // block som saknar underlag ska vara null/tomma — aldrig kasta
        expect(Array.isArray(d.lvAsSubject)).toBe(true);
        expect(Array.isArray(d.suggestions)).toBe(true);
    });

    it('okänd nyckel ger null i stället för att kasta', () => {
        expect(win.__buildGruppdossier('finns-inte|Z')).toBeNull();
    });

    it('textversionen innehåller gränsdragningen mot sakliga skäl', () => {
        const d = win.__buildGruppdossier(win.__gruppdossierCandidates()[0].key);
        const txt = win.__gruppdossierAsText(d);
        expect(txt).toMatch(/^Gruppdossier: /);
        expect(txt).toContain('dokumenterar inte sakliga skäl');
    });

    it('robusthet: kvinnotröskel-körningen ÅTERSTÄLLER state', () => {
        win.__state.likvardighet.kvinnoTrosholdPct = 60;
        const r = win.__robusthetLikvardighet([55, 60, 65]);
        expect(win.__state.likvardighet.kvinnoTrosholdPct).toBe(60);   // kritiskt
        expect(r.trösklar).toEqual([55, 60, 65]);
        r.rows.forEach(row => {
            expect(row.hits).toBeGreaterThanOrEqual(1);
            expect(row.hits).toBeLessThanOrEqual(3);
        });
    });

    it('robusthet: prioriteringsjämförelsen flaggar när bara en referens finns', () => {
        const saved = win.__state.policy;
        win.__state.policy = [];
        const r = win.__robusthetPrioritering();
        expect(r.tooFew === true || r.refs.length >= 2).toBe(true);
        win.__state.policy = saved;
    });

    it('färdigcheck ger observationer med nivå och detalj', () => {
        const items = win.__buildFardigcheck();
        expect(Array.isArray(items)).toBe(true);
        items.forEach(i => {
            expect(['warn', 'info']).toContain(i.level);
            expect(typeof i.title).toBe('string');
            expect(i.title.length).toBeGreaterThan(0);
            expect(typeof i.detail).toBe('string');
        });
    });

    it('kvalitetssäkringsfliken renderar båda panelerna utan kast', () => {
        expect(() => win.__renderKvalitetssakring()).not.toThrow();
        expect(win.document.getElementById('robusthet-body')).not.toBeNull();
        expect(win.document.getElementById('fardigcheck-body')).not.toBeNull();
    });
});

describe('förbättringar: modal-dossier och manuell robusthetsanalys', () => {
    it('gruppdossiern är INTE en flik längre utan en modal', () => {
        expect(win.document.getElementById('tab-gruppdossier')).toBeNull();
        expect(win.document.getElementById('view-gruppdossier')).toBeNull();
        expect(win.document.getElementById('dossier-modal')).not.toBeNull();
    });

    it('modalen öppnas med vald grupp och stängs igen', () => {
        win.__loadDemoData();
        const key = win.__gruppdossierCandidates()[0].key;
        win.__openGruppdossier(key);
        const modal = win.document.getElementById('dossier-modal');
        expect(modal.style.display).toBe('flex');
        expect(win.document.getElementById('dossier-select').value).toBe(key);
        expect(win.document.getElementById('dossier-body').innerHTML.length).toBeGreaterThan(50);
        win.__closeGruppdossier();
        expect(modal.style.display).toBe('none');
    });

    it('robusthetspanelen visar en startknapp i stället för att räkna direkt', () => {
        win.__renderKvalitetssakring();
        const host = win.document.getElementById('robusthet-body');
        expect(host.querySelector('#btn-run-robusthet')).not.toBeNull();
        // färdigchecken är billig och körs direkt
        expect(win.document.getElementById('fardigcheck-body').innerHTML.length).toBeGreaterThan(20);
    });

    it('robusthetsanalysen producerar resultat när den körs', async () => {
        win.__runRobusthet();
        await new Promise(r => setTimeout(r, 120));   // renderingen är fördröjd för att hinna måla om
        const host = win.document.getElementById('robusthet-body');
        expect(host.innerHTML).toMatch(/Likvärdigt arbete|Prioritering/);
    });
});

describe('k-anonymitet, sortering, efterlevnad och dossiern — dossiern', () => {
    it('hypotesrutan i dossiern renderar markup i stället för att visa taggar', () => {
        win.__loadDemoData();
        const key = win.__gruppdossierCandidates()[0].key;
        const d = win.__buildGruppdossier(key);
        win.__openGruppdossier(key);
        const body = win.document.getElementById('dossier-body');
        expect(body.innerHTML).not.toContain('&lt;strong&gt;');
        if (d.suggestions.length) {
            // textkopian ska däremot vara fri från markup
            expect(win.__gruppdossierAsText(d)).not.toMatch(/<\/?strong>/);
        }
        win.__closeGruppdossier();
    });
});

describe('exportmeny på alla diagram', () => {
    const vanta = () => new Promise(r => setTimeout(r, 0));
    beforeAll(async () => {
        win.__loadDemoData();
        for (const flik of ['matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
                            'kon', 'demografi', 'utforska', 'benchmark', 'kvalitet', 'rapport']) {
            win.__renderTabContent(flik);
        }
        await vanta();
    });

    it('varje diagram som ritats har en exportknapp', () => {
        // Ritade av diagramkärnan (_figur, ADR-39).
        const ritade = [...win.document.querySelectorAll('div')].filter(el => el._figur);
        expect(ritade.length).toBeGreaterThan(10);
        const utan = ritade.filter(el => !el.closest('[data-no-export]')
            && !el.parentElement.querySelector(':scope > .chart-export'));
        expect(utan.map(el => el.id)).toEqual([]);
    });

    it('knappen läggs bara till en gång även om diagrammet ritas om', async () => {
        win.__renderTabContent('demografi');
        await vanta();
        const host = win.document.getElementById('chart-demo-hist').parentElement;
        expect(host.querySelectorAll(':scope > .chart-export')).toHaveLength(1);
    });

    it('knappen öppnar menyn och Escape stänger den', () => {
        const host = win.document.getElementById('chart-demo-hist').parentElement;
        const btn = host.querySelector('.chart-export-btn');
        const meny = host.querySelector('.chart-export-meny');
        btn.click();
        expect(meny.hidden).toBe(false);
        expect(btn.getAttribute('aria-expanded')).toBe('true');
        win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape' }));
        expect(meny.hidden).toBe(true);
        expect(btn.getAttribute('aria-expanded')).toBe('false');
    });

    it('menyn har fem val', () => {
        const meny = win.document.getElementById('chart-demo-hist').parentElement.querySelector('.chart-export-meny');
        expect([...meny.querySelectorAll('[data-chart-export]')].map(b => b.getAttribute('data-chart-export')))
            .toEqual(['png-presentation', 'png-dokument', 'svg', 'data-kopiera', 'data-csv']);
    });

    it('filnamnet bygger på flik, rubrik och datum och märks i demoläget', () => {
        const gd = win.document.getElementById('chart-demo-hist');
        expect(win.__chartExportFilename(gd, 'png', new Date(2026, 8, 24)))
            .toBe('DEMO_Demografi_Åldersfördelning-per-5-årsintervall_2026-09-24.png');
    });

    it('diagramdatan börjar med rubrik och version och innehåller seriernas värden', () => {
        const rows = win.__chartExportRows(win.document.getElementById('chart-demo-hist'));
        expect(rows[0][0]).toMatch(/^Åldersfördelning per 5-årsintervall — Lönekartläggning \d{4}\.\d{2}\.\d{2}\. Minsta gruppstorlek för redovisning: 10\.$/);
        expect(rows[1][0]).toBe('Serie');
        expect(rows.length).toBeGreaterThan(3);
    });

    it('en behållare märkt med markeraUtanExport får ingen meny, och skälet står i verktygstipset', () => {
        const box = win.document.createElement('div');
        win.__markeraUtanExport(box, 'individer');
        expect(box.getAttribute('data-no-export')).toBe('individer');
        expect(box.title).toMatch(/^Lämnar inte verktyget: hör till Personer att granska/);
        const gd = win.document.createElement('div');
        box.appendChild(gd);
        win.document.body.appendChild(box);
        expect(win.__exportTillaten(gd)).toBe(false);
        win.__attachChartExport(gd);
        expect(box.querySelector('.chart-export')).toBeNull();
        box.remove();
        gd.remove();
        expect(win.__exportTillaten(gd)).toBe(true);   // utanför behållaren gäller ingen spärr
        // Ett skäl som inte är registrerat går inte att använda.
        expect(() => win.__markeraUtanExport(win.document.createElement('div'), 'hemligt')).toThrow(/okänt skäl/);
    });

    it('varje behållare utan export i det ritade dokumentet har ett registrerat skäl', () => {
        // Alla flikar är ritade (beforeAll); Lika arbete bär den märkta behållaren.
        win.__renderTabContent('dashboard');
        const skal = win.__exportSkal();
        const markta = [...win.document.querySelectorAll('[data-no-export]')];
        expect(markta.map(el => el.id).sort()).toEqual(['pag-diagram-ruta']);
        for (const el of markta) {
            const s = el.getAttribute('data-no-export');
            expect(Object.keys(skal), el.id).toContain(s);
            expect(el.title, el.id).toBe(`Lämnar inte verktyget: ${skal[s]}.`);
            expect(win.__exportTillaten(el)).toBe(false);
        }
        // Inget ritat diagram i en märkt behållare har en meny, och ett ritat diagram i den ger ingen bild.
        for (const gd of [...win.document.querySelectorAll('[data-no-export] div')].filter(el => el._figur)) {
            expect(gd.parentElement.querySelector(':scope > .chart-export'), gd.id).toBeNull();
            expect(win.__chartExportRows(gd), gd.id).toEqual([]);
        }
    });

});

// A5 (beslut 4a): Prioriteringen mäter löneläget mot er referens och har egna ord, så att de inte förväxlas med
// uppmärksamhetstrappan för skillnaden mellan kvinnor och män (Värt att granska, Följ upp, Balanserat).
describe('Prioritering: egna ord och rätt rubrik (A5)', () => {
    const TRAPPAN = /Värt att granska|Följ upp|Balanserat/;
    const oppna = () => { const w = createAppWindow(); w.__loadDemoData(); w.__renderTabContent('prioritering'); return w; };
    it('fliken har Prioriteringens egna ord, och nyckeltalet heter Kostnad att nå referensen', () => {
        const w = oppna();
        const d = w.document;
        // Kolumnen Skillnad kön bär uppmärksamhetstrappans bricka (ADR-71); den gäller skillnaden mellan kvinnor och män
        // och prövas för sig nedan.
        const vy = d.getElementById('view-prioritering').cloneNode(true);
        vy.querySelectorAll('.prio-konstatus').forEach(e => e.remove());
        expect(d.querySelectorAll('#prio-table tbody tr').length).toBeGreaterThan(0);
        expect(vy.textContent).not.toMatch(TRAPPAN);
        expect([...vy.querySelectorAll('[data-tooltip], [data-k-tooltip], [data-export-label], [title]')]
            .map(e => ['data-tooltip', 'data-k-tooltip', 'data-export-label', 'title'].map(a => e.getAttribute(a) || '').join(' '))
            .filter(t => TRAPPAN.test(t))).toEqual([]);
        expect(w.eval('Object.values(PRIO_STATUS_INFO).map(s => s.label)')).toEqual(['Börja här', 'Under referens, liten grupp', 'Nära referens, under', 'Nära referens', 'Över referens']);
        const ruta = d.getElementById('prio-stat-cost').closest('.stat-box');
        expect(ruta.querySelector('.stat-etikett').textContent.trim()).toBe('Kostnad att nå referensen');
        // Förklaringen står under nyckeltalsraden (i rutan skulle den klippas).
        const not = d.getElementById('prio-stat-cost-not').textContent.replace(/\s+/g, ' ');
        expect(not).toContain('Vad det kostar att lyfta grupper under referensen till dess median. Detta är löneläget mot er referens, inte lönekartläggningens könsskillnader — dem visar Lika arbete och Löneöversyn.');
        expect(not).toContain('inkl. PO-påslag 40 % (ett standardantagande; sätt organisationens eget under Inställningar)');
        expect(d.getElementById('prio-stat-cost-period').textContent).toBe('12 månader, inkl. PO-påslag 40\u00a0%');
        expect(vy.textContent).not.toMatch(/åtgärdskostnad/i);
    });
    // Nyckeltalen heter som statusarna och räknar tabellens rader; Färdigcheck räknar samma grupper (uppgift 3, UX 2026-11-19).
    it('nyckeltalen räknar tabellens statusar, och Färdigcheck säger samma tal med samma gräns', () => {
        const w = oppna();
        const d = w.document;
        const rader = [...d.querySelectorAll('#prio-table tbody tr')].map(tr => tr._prioItem);
        const items = w.eval('computePrioritization(_selectedPrioReference())');
        expect(rader.length).toBe(items.length);
        const antal = s => rader.filter(i => i.status === s).length;
        const ruta = id => d.getElementById(id).closest('.stat-box');
        const nyckel = [['prio-stat-akut', 'akut', 'Börja här'], ['prio-stat-under', 'atgard', 'Under referens, liten grupp'], ['prio-stat-over', 'analysera', 'Över referens']];
        for (const [id, status, namn] of nyckel) {
            expect(ruta(id).querySelector('.stat-etikett').textContent.trim()).toBe(namn);
            expect(w.eval(`PRIO_STATUS_INFO.${status}.label`)).toBe(namn);
            expect(d.getElementById(id).textContent, namn).toBe(String(antal(status)));
        }
        // Statuscellen i tabellen bär samma ord som nyckeltalet.
        for (const tr of d.querySelectorAll('#prio-table tbody tr')) expect(tr.textContent).toContain(w.eval(`PRIO_STATUS_INFO.${tr._prioItem.status}.label`));
        expect(d.getElementById('prio-stat-akut-not').textContent).toBe('mer än 5\u00a0% under, minst 10 personer');
        expect(d.getElementById('prio-stat-under-not').textContent).toBe('mer än 5\u00a0% under, färre än 10 personer');
        expect(d.getElementById('prio-stat-over-not').textContent).toBe('mer än 5\u00a0% över');
        // Färdigcheck: alla under noll, varav Börja här och Under referens, liten grupp.
        const under = items.filter(i => i.diffPct < 0).length, varav = antal('akut') + antal('atgard');
        expect(under).toBeGreaterThan(varav); expect(varav).toBeGreaterThan(0);
        const punkt = w.eval('buildFardigcheck()').find(p => p.id === 'flaggade-grupper');
        expect(punkt.title).toBe(`${under} grupper ligger under referensen, varav ${varav} mer än 5\u00a0% under`);
    });
    it('nyckeltalens undertexter, matrisens zoner och Färdigcheck följer inställda gränser', () => {
        const w = oppna();
        const d = w.document;
        w.eval('state.prioConfig = { atgardThreshold: -2.5, akutMinN: 30, bevakaThreshold: -1, analyseraThreshold: 3 }');
        w.__renderTabContent('prioritering');
        expect(d.getElementById('prio-stat-akut-not').textContent).toBe('mer än 2,5\u00a0% under, minst 30 personer');
        expect(d.getElementById('prio-stat-under-not').textContent).toBe('mer än 2,5\u00a0% under, färre än 30 personer');
        expect(d.getElementById('prio-stat-over-not').textContent).toBe('mer än 3\u00a0% över');
        const items = w.eval('computePrioritization(_selectedPrioReference())');
        for (const [id, status] of [['prio-stat-akut', 'akut'], ['prio-stat-under', 'atgard'], ['prio-stat-over', 'analysera']]) {
            expect(d.getElementById(id).textContent).toBe(String(items.filter(i => i.status === status).length));
        }
        const f = w.eval("_prioMatrisFigur(computePrioritization(_selectedPrioReference()), 'topp10', 'referensen', state.prioConfig)");
        expect(f.referens.map(z => z.etikett)).toEqual(['MER ÄN 2,5\u00a0% UNDER', 'NÄRA REFERENS, UNDER', 'NÄRA REFERENS', 'MER ÄN 3\u00a0% ÖVER']);
        const punkt = w.eval('buildFardigcheck()').find(p => p.id === 'flaggade-grupper');
        const varav = items.filter(i => i.status === 'akut' || i.status === 'atgard').length;
        expect(punkt.title).toBe(`${items.filter(i => i.diffPct < 0).length} grupper ligger under referensen, varav ${varav} mer än 2,5\u00a0% under`);
        // Utan grupper bortom gränsen står bara den första delen.
        w.eval('state.prioConfig = { atgardThreshold: -40, akutMinN: 10, bevakaThreshold: -2, analyseraThreshold: 5 }');
        expect(w.eval('buildFardigcheck()').find(p => p.id === 'flaggade-grupper').title).toMatch(/^\d+ grupper ligger under referensen$/);
    });
    it('kolumnen Skillnad kön bär uppmärksamhetstrappans bricka efter storleken, utan prövning (ADR-71)', () => {
        const w = oppna();
        const rader = [...w.document.querySelectorAll('#prio-table tbody tr')];
        expect(rader.length).toBeGreaterThan(0);
        const golv = w.eval('statGolv()');
        const nivaer = new Set();
        rader.forEach(tr => {
            const i = tr._prioItem;
            const bricka = tr.querySelectorAll('.prio-konstatus');
            expect(bricka.length).toBe(1);
            const b = bricka[0];
            // Brickan står i samma cell som talet för skillnaden mellan kvinnor och män.
            expect(b.closest('td').querySelector('.cell-bar-wrap')).not.toBeNull();
            const vantad = i.gapPct === null || !(i.kvN >= golv && i.maN >= golv) ? 'ejbedomd'
                : Math.abs(i.gapPct) >= 3 ? 'folj' : 'balanserat';
            expect(b.getAttribute('data-niva')).toBe(vantad);
            expect(b.textContent).toBe({ ejbedomd: 'Går ej att bedöma', folj: 'Följ upp', balanserat: 'Balanserat' }[vantad]);
            nivaer.add(vantad);
        });
        // Prioriteringen prövar inte skillnaden mot slumpen: aldrig Värt att granska.
        expect(nivaer.has('granska')).toBe(false);
        // Exporten bär talet, inte brickan.
        const matris = w.__tableToMatrix('prio-table');
        expect(matris.flat().join(' ')).not.toMatch(/Följ upp|Balanserat|Går ej att bedöma/);
    });
    it('inställningarnas förklaringar för Prioriteringens trösklar använder samma ord', () => {
        const w = oppna();
        const txt = ['prio-cfg-atgard', 'prio-cfg-akutN', 'prio-cfg-bevaka', 'prio-cfg-analysera']
            .map(id => w.document.getElementById(id).closest('label').textContent).join(' ');
        expect(txt).not.toMatch(TRAPPAN);
        expect(txt).toMatch(/Under referens, liten grupp/);
        expect(txt).toMatch(/Nära referens, under/);
    });
    it('förslagen säger hur nära referensen gruppen ligger, utan att avfärda skillnaden', () => {
        const w = oppna();
        w.__it = { diffPct: 0.8, n: 12, kvN: 12, maN: 12, _rows: [{ lon: 1, kon: 'kvinna', alder: 40 }] };
        const nara = w.eval('generateMotivationSuggestions(window.__it)').map(f => f.text).join(' ');
        expect(nara).toContain('Gruppens median ligger inom ±2 % av referensen.');
        expect(nara).not.toMatch(/normal variation|kräver ytterligare utredning/);
        w.__it = { ...w.__it, diffPct: 7.4 };
        expect(w.eval('generateMotivationSuggestions(window.__it)').map(f => f.text)).toContain('Ligger 7,4\u00a0% över referensen. Dokumentera gärna varför.');
    });
    it('snabb vinst säger villkoret i klarspråk, också för en stor grupp (inget "få personer")', () => {
        const w = oppna();
        w.__it = { diffPct: -4, n: 300, kvN: 150, maN: 150, costPerPerson: 1200, isQuickWin: true, _rows: [{ lon: 1, kon: 'kvinna', alder: 40 }] };
        const txt = w.eval('generateMotivationSuggestions(window.__it)').map(f => f.text).join(' ');
        expect(txt).toMatch(/Snabb vinst:<\/strong> gruppen ligger mer än 3\s%\s+under referensen, och kostnaden per person är under 1\s500\s+kr per månad \(300 personer\)\./);
        expect(txt).not.toMatch(/få personer|hanterbar/);
    });
    it('Excel-bladet Prioritering, handlingsplanen och rapporten har samma ord', async () => {
        const { laddaXlsx, fangaBocker } = await import('./helpers/ktroskel-rigg.js');
        const w = oppna();
        await laddaXlsx(w);
        const bok = Object.values(fangaBocker(w, () => w.eval('exportAllToExcel()')))[0];
        const blad = bok.split(/\n(?=\[)/).find(b => b.startsWith('[Prioritering]'));
        expect(blad).toBeTruthy();
        expect(blad).not.toMatch(TRAPPAN);
        expect(blad).toContain('Kostnad att nå referensen');
        const hp = Object.values(fangaBocker(w, () => w.eval('exportHandlingsplan()')))[0];
        expect(hp).toContain('Kostnad att nå referensen');
        const atgarder = w.eval('rapportModell({ alla: true })').avsnitt.find(a => a.id === 'atgarder');
        expect(JSON.stringify(atgarder)).not.toMatch(TRAPPAN);
        expect(JSON.stringify(atgarder)).toContain('kostnad att nå referensen');
        const block = w.__rapportunderlagBlock().find(b => b.id === 'handlingsplan');
        expect(w.__ruTillText(block)).toContain('kostnad att nå referensen');
        expect(w.__ruTillText(block)).not.toMatch(TRAPPAN);
    });
    it('Att göra kallar grupperna under referensen Löneläge mot referens, inte Värt att granska', () => {
        const w = oppna();
        const prio = w.eval('buildActionChecklist()').filter(i => i.källa === 'Prioriteringsanalys');
        expect(prio.length).toBeGreaterThan(0);
        expect([...new Set(prio.map(i => i.kategori))]).toEqual(['Löneläge mot referens']);
        expect(prio.map(i => i.detalj).join(' ')).not.toMatch(/kostnad att lyfta till referens/);
    });
});

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Översikt i appen: ordningen, nyckeltalen, namnfälten, samma bild som flikarna, Att göra och Underlagets kvalitet
// (kvalitetsdelen, AID-kodningen och efterlevnadskortet).
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { las } from './helpers/granssnitt-rigg.js';
import { borjaHar } from '../src/lib/attgora.js';

let win;

beforeAll(() => {
    win = createAppWindow();
    win.__loadDemoData();   // blocken nedan läser demodatan
});

describe('Översikt: ordning, kvalitet och nyckeltal', () => {
    it('nyckeltal → Att göra → processen → löneskillnaden; kvaliteten står i Filer och kvalitet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        expect(d.getElementById('view-filer').contains(d.getElementById('underlagets-kvalitet'))).toBe(true);
        const ids = ['dashboard-summary', 'att-gora', 'process-tracker', 'gap-uppdelning'];
        const pos = ids.map(id => d.getElementById(id));
        for (let i = 1; i < pos.length; i++) {
            expect(pos[i - 1].compareDocumentPosition(pos[i]) & w.Node.DOCUMENT_POSITION_FOLLOWING, `${ids[i - 1]} före ${ids[i]}`).toBeTruthy();
        }
    });
    it('kvaliteten sammanfattad; ihopfälld när allt är OK, utfälld vid varning; konsistensen inuti', () => {
        const w = createAppWindow();
        w.__loadDemoData();   // demot har en varning (jämförbarhet)
        const d = w.document;
        const fall = d.getElementById('uk-fallbar');
        expect(fall.tagName).toBe('DETAILS');
        expect(fall.open).toBe(true);
        expect(d.getElementById('uk-sammanfattning').textContent).toMatch(/\d+ av \d+ kriterier OK/);
        expect(d.getElementById('uk-sammanfattning').textContent).toMatch(/Jämförbarhet/);
        expect(fall.contains(d.getElementById('consistency-banner-container'))).toBe(true);
        w.eval("bedomningUnderlag = () => ({ status: 'ok', kriterier: [{ id: 'a', namn: 'A', status: 'ok', text: 'x' }] }); ritaUnderlagetsKvalitet();");
        expect(fall.open).toBe(false);
        expect(d.getElementById('uk-sammanfattning').textContent).toMatch(/1 av 1 kriterier OK/);
    });
    it('nyckeltalen visar kvinnor och män i stället för antal BAS-intervall', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        expect(d.getElementById('stat-bas')).toBeNull();
        const kv = w.__state.data.filter(r => r.kon === 'kvinna').length, ma = w.__state.data.filter(r => r.kon === 'man').length;
        expect(d.getElementById('stat-kon').textContent.replace(/\s/g, '')).toBe(`${kv}/${ma}`);
        expect(d.getElementById('dashboard-summary').textContent).toMatch(/Kvinnor \/ män/);
    });
});

describe('Översikt och namn: namnfälten och kvalitetsdelen', () => {
    it('statistikens och referensens namn sätts alltid som text i diagrammets verktygstips', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state.statistik = w.__state.data.slice(0, 40).map(r => ({ aid: r.aid, bas: r.bas, median: 35000, p10: 31000, p90: 40000 }));
        w.eval("sattJmfNamn('<img src=x onerror=alert(1)>')");
        w.__ritaFlik('benchmark');
        // Diagramkärnan (ADR-39): namnet står i serien och i verktygstipset, och sätts alltid som text.
        const el = w.document.getElementById('chart-jamforelse-spann');
        expect(el.querySelector('img')).toBeNull();
        w.__el = el;
        const tips = el._figur.lager.map(l => w.eval('_rfTipsHtml')(l.tips(l.data[0]))).join('');
        expect(tips).not.toMatch(/<img/);
    });
    it('ett avvisat namn visar felet vid fältet, i alla namnfält', () => {
        const w = createAppWindow();
        for (const id of ['org-namn', 'jmf-namn', 'kl-org-name']) {
            const el = w.document.getElementById(id);
            el.value = 'Anna 19800101-1234';
            el.dispatchEvent(new w.Event('change'));
            const fel = el.closest('.upload-cell, .ref-namn-rad, .namn-falt')?.querySelector('.upload-namn-fel');
            expect(fel, id).toBeTruthy();
            expect(fel.hidden, id).toBe(false);
            expect(fel.textContent, id).toMatch(/personnummer/);
        }
    });
    it('en konfigurationsfil utan namn raderar inte paketets namn', () => {
        const w = createAppWindow();
        const cfg = w.__byggKonfiguration();   // utan namn
        w.eval("sattOrgNamn('Paketkommunen'); sattJmfNamn('SKR-statistik')");
        w.__tillampaKonfiguration(cfg);
        expect(w.eval('orgNamn()')).toBe('Paketkommunen');
        expect(w.eval('jmfNamn()')).toBe('SKR-statistik');
    });
    it('en riktig lönefil efter demot bär inte demots namn eller ställningstagande', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const w = createAppWindow();
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
        w.__loadDemoData();
        const rader = ['BAS;Månadslön;Ålder;Kön;AID'];
        for (let i = 0; i < 20; i++) rader.push(`A;${30000 + i};40;${i % 2 ? 'Man' : 'Kvinna'};5301`);
        w.__state.data = [];
        w.lasInStrukturfil(new w.File([rader.join('\n')], 'riktig.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && w.__state.data.length !== 20; i++) await new Promise(r => setTimeout(r, 20));
        expect(w.__state.isDemo).toBe(false);
        expect(w.eval("orgNamn('')")).toBe('');
        expect(w.__state.policyKalla).not.toBe('demo');
        expect(w.document.getElementById('upload-cell-policy').classList.contains('loaded')).toBe(false);
    });
    it('en konsistensvarning fäller ut kvalitetsdelen även när kriterierna är OK', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval("bedomningUnderlag = () => ({ status: 'ok', kriterier: [{ id: 'a', namn: 'A', status: 'ok', text: 'x' }] })");
        w.document.getElementById('consistency-banner-container').innerHTML = '<div class="consistency-banner warn">Filerna matchar inte</div>';
        w.eval('ritaUnderlagetsKvalitet()');
        expect(w.document.getElementById('uk-fallbar').open).toBe(true);
    });
});

describe('Jämförelsestatistik, Översikt och namn: detaljer — Översikt', () => {
    it('kvalitetsdelen fälls inte ut igen vid omritning när statusen är densamma', () => {
        const w = createAppWindow();
        w.__loadDemoData();   // varning → utfälld
        const fall = w.document.getElementById('uk-fallbar');
        expect(fall.open).toBe(true);
        fall.open = false;
        w.eval('ritaUnderlagetsKvalitet()');
        expect(fall.open).toBe(false);
        w.eval("bedomningUnderlag = () => ({ status: 'kritisk', kriterier: [{ id: 'a', namn: 'A', status: 'kritisk', text: 'x' }] }); ritaUnderlagetsKvalitet();");
        expect(fall.open).toBe(true);
    });
});

describe('underlagets kvalitet (ADR-19)', () => {
    let w;
    beforeAll(() => { w = createAppWindow(); w.__loadDemoData(); });

    it('panelen visar datakvalitetens fem kriterier, AID-kontrollen och en helhetsstatus, ingen 0–100-siffra', () => {
        const p = w.document.getElementById('underlagets-kvalitet');
        expect(p).toBeTruthy();
        expect(p.querySelector('#uk-fallbar')).not.toBeNull();   // sammanfattad, utfälld vid varning (ADR-36)
        expect([...p.querySelectorAll('.uk-rad')].map(r => r.dataset.id))
            .toEqual(['jamforbarhet', 'styrka', 'fullstandighet', 'rimlighet', 'modell',
                'aid-okanda', 'aid-restkoder', 'aid-spridning', 'aid-ledning-utan-ansvar', 'aid-otillaten-ansvarskod']);
        expect(['ok', 'varning', 'kritisk']).toContain(p.dataset.status);
        expect(p.textContent).not.toMatch(/\/100/);
    });
    it('demodatan: 2 av 5 BAS maskeras → jämförbarheten är inte OK', () => {
        const j = w.__bedomningUnderlag().kriterier.find(c => c.id === 'jamforbarhet');
        expect(j.status).not.toBe('ok');
        expect(j.text).toContain('maskeras');
    });
    it('datakvalitetsindexet, styrkekortet och guiden finns inte kvar', () => {
        expect(w.document.getElementById('data-quality-card')).toBeNull();
        expect(w.document.getElementById('power-analysis-card')).toBeNull();
        expect(w.document.body.textContent).not.toContain('Datakvalitetsindex');
        expect(typeof w.computeDataQualityIndex).toBe('undefined');
    });
    it('Word-utkastet redovisar inget 0–100-index', () => {
        expect(w.__docDraftHtml()).not.toContain('/100');
    });
});

describe('samma bild på Översikt', () => {
    let w;
    beforeAll(() => { w = createAppWindow(); w.__loadDemoData(); });

    it('kompliansen räknar bara jämförbara BAS och säger hur många intervall exporten inte redovisar', () => {
        w.__ritaKravstatus();
        const t = w.document.getElementById('comp-gap').textContent;
        expect(t).toMatch(/av \d+ jämförbara BAS-intervall/);
        expect(t).toMatch(/\d+ intervall redovisas inte i exporten \(ett kön under \d+\)/);
        expect(t).not.toMatch(/maskeras/);
    });
    it('referensens P10 skrivs "P10 i {referens}", utan genitiv-s efter kolon', () => {
        w.__ritaKravstatus();
        const t = w.document.getElementById('comp-pol-label').textContent;
        expect(t).not.toMatch(/:s\b/);
        if (w.eval('harReferens()')) expect(t).toBe(`Under P10 i ${w.eval('referensKortnamn()')}`);
    });
    it('Lika arbete AID x BAS: nyckeltalet är detsamma som tabellen per AID-etikett, i båda lägena (ADR-90)', () => {
        for (const lage of ['export', 'skarm']) {
            w.__state.kLage = lage;
            w.__ritaFlik('matrix');
            const nyckel = w.document.getElementById('nyckel-la-aidbas').textContent;
            expect(nyckel, lage).toMatch(/^\d+ att granska/);
            expect(nyckel, lage).toBe(w.document.getElementById('nyckel-la-yrkesgrupper').textContent);
            // Trattens not ger ingen egen status.
            expect(w.document.getElementById('la-tratt-not').textContent).not.toMatch(/bedömda grupper/);
        }
        w.__state.kLage = 'skarm';
    });
    it('en röd gap-ruta står aldrig bredvid en tom åtgärdslista', () => {
        w.__ritaKravstatus();
        w.eval('renderActionChecklist()');
        const kort = w.document.getElementById('comp-gap');
        const rod = /crit|warn/.test(kort.className);
        const lista = w.document.getElementById('action-checklist-container').textContent;
        if (rod) expect(lista).not.toContain('inga öppna punkter');
    });
    it('varje jämförbart BAS med statusen Värt att granska (säkerställd, minst 3 %) blir en punkt i åtgärdslistan, och inga andra', () => {
        const ids = w.eval('buildActionChecklist()').map(i => i.id);
        const d = w.__hamtaData();
        const jb = new Set(w.__dqJamforbaraBas(d, w.__K).jamforbara);
        const rader = w.eval('_laOversiktRader(hamtaData())').filter(o => jb.has(o.bas));
        const flaggade = rader.filter(o => w.eval(`_laOversiktStatus(${JSON.stringify(o)}).niva`) === 'granska').map(o => o.bas);
        expect(flaggade.length, 'demodatan ska ha minst ett BAS att granska').toBeGreaterThan(0);
        flaggade.forEach(b => expect(ids).toContain('gap-bas-' + b));
        expect(ids.filter(i => i.startsWith('gap-bas-')).sort()).toEqual(flaggade.map(b => 'gap-bas-' + b).sort());
        // Rutan på Översikt räknar samma intervall.
        w.eval('ritaKravstatus()');
        expect(w.document.getElementById('comp-gap-val').textContent).toMatch(new RegExp(`^${flaggade.length} `));
    });
    it('nyckeltalet hänvisar inte till EU-gränsen för hela organisationen', () => {
        w.eval('ritaNyckeltal()');
        const t = w.document.getElementById('dashboard-summary').textContent;
        expect(t).not.toContain('bör utredas enligt EU');
        // Under talet står bara vad det är; förklaringen ligger i verktygstipset (nyckeltalsraden är en rad hög).
        expect(t).toContain('rå skillnad, innan AID-etikett och BAS-intervall räknats bort');
        const tip = w.document.querySelector('#stat-paygap .stat-tip');
        expect(tip.getAttribute('title')).toContain('före hänsyn till AID-etikett, BAS-intervall och ålder');
        // Rågapet är en utgångspunkt, inget fynd: neutral färg också när det är långt från 100 %.
        expect(tip.classList.contains('crit')).toBe(false);
        expect(tip.classList.contains('ok')).toBe(false);
    });
    it('inledningen står på en rad med «Visa mer», och fliken upprepar inte sitt namn', () => {
        const d = w.document;
        const rader = [...d.querySelectorAll('.flik-intro-rad')];
        expect(rader.length).toBe(d.querySelectorAll('.flik-intro').length);                 // varje inledning ligger i en rad
        expect(rader.every(r => r.querySelectorAll('.flik-intro').length === 1 && r.querySelectorAll('button.flik-intro-mer').length === 1)).toBe(true);
        const rad = d.querySelector('#view-regression .flik-intro-rad, #view-lika-yrken .flik-intro-rad') || rader[0], knapp = rad.querySelector('.flik-intro-mer');
        expect([rad.classList.contains('ar-utfalld'), knapp.getAttribute('aria-expanded'), knapp.textContent]).toEqual([false, 'false', 'Visa mer']);
        knapp.click();
        expect([rad.classList.contains('ar-utfalld'), knapp.getAttribute('aria-expanded'), knapp.textContent]).toEqual([true, 'true', 'Visa mindre']);
        knapp.click();
        expect(rad.classList.contains('ar-utfalld')).toBe(false);
        w.eval('introRader()');                                                               // ett anrop till ger inga dubbla knappar
        expect(d.querySelectorAll('.flik-intro-mer').length).toBe(rader.length);
        // Sidhuvudet bär flikens namn; inledningens fetstil bär frågan, inte namnet en gång till.
        const titlar = Object.values(w.eval('typeof FLIKTITLAR !== "undefined" ? FLIKTITLAR : {}'));
        for (const st of d.querySelectorAll('.flik-intro > strong:first-child')) expect(st.textContent, st.textContent).not.toMatch(/^(Lika arbete|Likvärdigt arbete|Löneöversyn|Handlingsplan|Regler & praxis|Lönestruktur|Exportera|Löneläget|Tabeller och egna vyer|Löneöversikt) —|^(Lönestruktur|Exportera|Löneläget|Tabeller och egna vyer)$/);
        expect(titlar).toBeDefined();
    });
    it('Löneöversyn och Översikt följer flikmallen: inledning, nyckeltal i toppen, sedan innehållet', () => {
        w.__loadDemoData();
        const d = w.document, ren = t => t.replace(/[\u00a0\u202f]/g, ' ');
        d.querySelector('.nav-item[data-tab="loneoversyn"]').click();
        d.getElementById('forecast-budget-value').value = '2';
        d.getElementById('forecast-budget-value').dispatchEvent(new w.Event('input', { bubbles: true }));
        const kort = [...d.querySelectorAll('#lo-slutsatser .slutsats')].map(k => [k.querySelector('.slutsats-etikett').textContent, ren(k.querySelector('.slutsats-varde').textContent), ren(k.querySelector('.slutsats-under').textContent)]);
        expect(kort.map(k => k[0])).toEqual(['Pott', 'Använt', 'Kvar att fördela', 'Lönesumma per månad', 'Total kostnad']);
        expect(kort[0][1]).toMatch(/^[\d ]+ kr$/);                                           // 2 % av lönesumman
        expect(kort[1][2]).toMatch(/^\d+ % av potten$/);
        expect(kort[4][2]).toMatch(/^\d+ mån, PO /);
        const fore = (a, b) => !!(d.getElementById(a).compareDocumentPosition(d.getElementById(b)) & 4);
        expect(fore('lo-slutsatser', 'forecast-budget-value') && fore('forecast-budget-value', 'forecast-meter')).toBe(true);
        // Talen står en gång: mätaren visar bara förloppet, och utfallet upprepar inte lönesumman och kostnaden.
        expect(d.getElementById('forecast-meter').textContent).not.toMatch(/Kvar att fördela|Pott \(kr\/mån\)/);
        expect(d.getElementById('forecast-meter').querySelector('[role="img"]')).not.toBeNull();
        expect(d.getElementById('forecast-outcome').textContent).not.toMatch(/Lönesumma\/mån/);
        // Översikt: inledningen står före filraden och nyckeltalen.
        expect(fore('ov-intro', 'ov-filrad') && fore('ov-filrad', 'dashboard-summary')).toBe(true);
        expect(d.getElementById('ov-intro').closest('.flik-intro-rad')).not.toBeNull();
    });
    it('rapporten bär de tre nya diagrammen, och åldersdiagrammet bara när Ålder & karriär visar hela urvalet', () => {
        w.__loadDemoData();
        const diagram = () => w.eval('rapportModell()').avsnitt.flatMap(a => a.delar.filter(x => x.typ === 'diagram').map(x => `${a.id}:${x.id}`));
        expect(diagram()).toEqual(expect.arrayContaining(['lika:chart-la-tratt', 'struktur:chart-kon-aldergap', 'struktur:chart-lp-konlagen']));
        w.__ritaFlik('kon');
        const val = w.document.getElementById('bas-select-kon'), ettBas = [...val.options].map(o => o.value).find(v => v && v !== '__ALLA__');
        val.value = ettBas;
        expect(diagram()).not.toContain('struktur:chart-kon-aldergap');                      // fliken visar ett enda BAS-intervall
        val.value = '__ALLA__';
        expect(diagram()).toContain('struktur:chart-kon-aldergap');
    });
    it('nyckeltalen är korta tal med en förklarande rad, och Prioritering följer flikarnas form', () => {
        w.__loadDemoData();
        w.__ritaFlik('kon');
        const d = w.document, ren = t => t.replace(/[\u00a0\u202f]/g, ' ');
        expect(ren(d.getElementById('kon-kpi-n').textContent)).toMatch(/^\d[\d ]*$/);              // bara antalet …
        expect(ren(d.getElementById('kon-kpi-n-under').textContent)).toMatch(/^\d+ kvinnor · \d+ män$/);   // … könen på raden under
        expect(ren(d.getElementById('kon-kpi-slope').textContent)).toMatch(/^[+−][\d ]+ \/ [+−][\d ]+ kr$/);
        expect(d.getElementById('kon-kpi-agegap').style.color).toBe('');                       // ingen röd siffra utan förklaring
        expect(d.getElementById('kon-kpi-agegap-under').textContent).toMatch(/^(skillnad över 5 %|kvinnors lön i % av mäns)$/);
        const pr = d.getElementById('view-prioritering');
        expect(pr.querySelector('.flik-intro strong').textContent).toBe('Vilka AID-etiketter bör prioriteras utifrån löneläget?');
        expect(pr.querySelectorAll('.valrad input[name="prio-ref"]').length).toBe(2);
        expect(pr.querySelector(':scope > .card')).toBeNull();                                 // inget kort runt hela fliken
        expect(pr.querySelectorAll('#prio-summary .stat-box[style]').length).toBe(0);          // inga egna färger på nyckeltalen
    });
});

describe('Att göra', () => {
    it('Om verktyget beskriver Översikt med Att göra', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app', '65-om-verktyget.js'), 'utf8');
        expect(src).toMatch(/Att göra/);
    });
    const rader = (kvLon, maLon) => {
        const r = [];
        for (let i = 0; i < 60; i++) r.push({ bas: 'ABC'[i % 3], kon: i % 2 ? 'man' : 'kvinna', alder: 25 + (i % 30),
            lon: (i % 2 ? maLon : kvLon) + (i % 7) * 50 + 'ABC'.indexOf('ABC'[i % 3]) * 2000, yrke: '100 Y', aid: '100', yrkeLabel: 'Y' });
        return r;
    };
    const med = (data) => { const w = createAppWindow(); w.__state.data = data; w.eval('fyllValjare(); lasUppFlikar();'); return w; };
    it('punkten om oförklarat gap: hög vid signifikant gap på minst 3 %, ingen när gapet inte är signifikant', () => {
        const hog = med(rader(30000, 33000)).eval('buildActionChecklist()').find(i => i.id === 'reg-oforklarat');
        expect(hog).toMatchObject({ kategori: 'Lika arbete', prioritet: 'hög', tab: 'struktur' });
        expect(hog.titel).toMatch(/Oförklarad löneskillnad i hela organisationen/);
        expect(med(rader(30000, 30000)).eval('buildActionChecklist()').some(i => i.id === 'reg-oforklarat')).toBe(false);
    });
    it('ett kort: statusrad, Börja här och hela listan; inget iakttagelseblock', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        const kort = d.getElementById('att-gora');
        expect(kort.hidden).toBe(false);
        for (const id of ['compliance-overview', 'att-gora-borja', 'action-checklist-container']) expect(kort.querySelector('#' + id)).not.toBeNull();
        expect(d.getElementById('insight-feed-container')).toBeNull();
        expect(d.getElementById('comp-gap-val').textContent).toMatch(/av \d+ jämförbara BAS-intervall|Inga jämförbara/);
        expect(kort.querySelector('#compliance-overview h2')).toBeNull();
        expect(kort.querySelector('#comp-gap a[data-go-to-tab="struktur"]')).not.toBeNull();
    });
    it('Börja här: högst tre ej avbockade punkter, hög prioritet först, därefter underlag och könsrelaterade fynd; avbockning byter punkt', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        const titlar = () => [...d.querySelectorAll('#att-gora-borja [data-borja-id]')].map(li => li.dataset.borjaId);
        const items = w.eval('buildActionChecklist()');
        const vantat = borjaHar(items, new Set()).map(it => it.id);   // regeln: src/lib/attgora.js
        expect(titlar()).toEqual(vantat);
        const cb = d.querySelector(`.act-cb[data-id="${vantat[0]}"]`);
        cb.checked = true; cb.dispatchEvent(new w.Event('change'));
        expect(titlar()).not.toContain(vantat[0]);
        expect(titlar().length).toBe(Math.min(3, items.length - 1));
    });
    it('allt avbockat: "Alla punkter är hanterade."; Rensa döljer kortet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__state._actionChecklistDone = new Set(w.eval('buildActionChecklist()').map(i => i.id));
        w.eval('renderActionChecklist()');
        expect(w.document.getElementById('att-gora-borja').textContent).toContain('Alla punkter är hanterade.');
        w.__rensaAllData();
        expect(w.document.getElementById('att-gora').hidden).toBe(true);
        expect(w.document.getElementById('att-gora-borja').textContent.trim()).toBe('');
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

describe('Att göra: en stil på status', () => {
    it('prioriteten bär statusmärket med egen form, och grupperna har den ritade pilen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.eval('renderActionChecklist()');
        const d = w.document;
        const prio = [...d.querySelectorAll('#action-checklist-container .ag-prio')];
        expect(prio.length).toBeGreaterThan(3);
        for (const p of prio) {
            const text = p.textContent.trim();
            expect(text).toMatch(/^(Hög|Medel|Låg)$/);
            expect(p.querySelector(text === 'Hög' ? 'svg.ikon-statusKritisk' : text === 'Medel' ? 'svg.ikon-statusVarning' : 'svg.ikon-bock')).toBeTruthy();
        }
        // S7 i punkt 26: märket står alltid på en egen rad ovanför rubriken, oavsett rubrikens längd.
        for (const p of prio) expect(p.parentElement.classList.contains('ag-huvud')).toBe(true);
        expect(las('src/style.css')).toMatch(/\.ag-huvud \{[^}]*flex-direction: column/);
        const grupper = [...d.querySelectorAll('#action-checklist-container details.ag-grupp')];
        expect(grupper.length).toBeGreaterThan(1);
        expect(grupper.every(g => !g.getAttribute('style') && !g.querySelector(':scope > summary').getAttribute('style'))).toBe(true);
        expect(las('src/style.css')).toContain('.ag-grupp > summary::-webkit-details-marker { display: none; }');
    });
});

describe('sortering, Att göra, kopiering och Likvärdigt arbete — Att göra', () => {
    it('Att göra: länkarna går att skilja åt för skärmläsare; datakvalitet leder till Underlagets kvalitet', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        const lankar = [...d.querySelectorAll('#att-gora a[data-go-to-tab]')];
        expect(lankar.length).toBeGreaterThan(4);
        // Samma namn får bara förekomma för samma mål (Börja här och hela listan pekar på samma punkt).
        const mal = new Map();
        for (const a of lankar) {
            const namn = a.getAttribute('aria-label') || a.textContent.trim();
            const dit = a.dataset.goToTab + '#' + (a.dataset.goToAnchor || '');
            expect(mal.get(namn) ?? dit, namn).toBe(dit);
            mal.set(namn, dit);
        }
        expect([...mal.keys()].filter(n => /^(Visa|Gå dit|öppna fliken) →$/.test(n))).toEqual([]);
        for (const a of lankar.filter(a => a.dataset.goToTab === 'dashboard')) expect(a.dataset.goToAnchor).toBe('underlagets-kvalitet');
        const cb = [...d.querySelectorAll('#att-gora .act-cb')].map(c => c.getAttribute('aria-label'));
        expect(new Set(cb).size).toBe(cb.length);
    });
    it('Att göra: oförklarat gap skrivs med riktningsord, inte med minustecken', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const it = w.eval('buildActionChecklist()').find(x => x.id === 'reg-oforklarat');
        expect(it).toBeTruthy();
        expect(it.titel).not.toMatch(/: [−-]/);
        expect(it.titel).toMatch(/kvinnor .* (lägre|högre) lön än män/i);
    });
    it('Att göra: rubrikordning h2 → h3, och länken till Jämförelse döljs utan jämförelsestatistik', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        const rubriker = [...d.querySelectorAll('#att-gora h1, #att-gora h2, #att-gora h3, #att-gora h4')].map(h => Number(h.tagName[1]));
        expect(rubriker[0]).toBe(2);
        for (let i = 1; i < rubriker.length; i++) expect(rubriker[i] - rubriker[i - 1], `rubrik ${i}`).toBeLessThanOrEqual(1);
        w.__state.statistik = [];
        w.eval('ritaKravstatus()');
        const lank = d.querySelector('#comp-bm .comp-lank');
        expect(lank.hidden || lank.closest('[hidden]') !== null).toBe(true);
    });
    it('Att göra: procenttal med decimalkomma och riktningsord, inga bindestreck som minus', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const texter = w.eval('buildActionChecklist()').flatMap(it => [it.titel, it.detalj]);
        expect(texter.length).toBeGreaterThan(3);
        for (const t of texter) {
            expect(t, t).not.toMatch(/\d\.\d/);
            expect(t, t).not.toMatch(/(^|[\s(])[-−]\d/);
        }
    });
});

describe('k-anonymitet, sortering, efterlevnad och dossiern — efterlevnad', () => {
    it('efterlevnadskortet blir inte grönt när policyn saknar BAS-nivårader', () => {
        const sparadPolicy = win.__state.policy;
        try {
            win.__loadDemoData();
            win.__state.policy = [{ aid: '5301', p10: 25000, med: 30000, p90: 40000 }];   // endast AID
            win.__ritaKravstatus();
            const card = win.document.getElementById('comp-pol');
            expect(card.className).toContain('na');
            expect(card.className).not.toContain('ok');
        } finally {
            win.__state.policy = sparadPolicy;
        }
    });
});

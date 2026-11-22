// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Start och meny i appen: att verktyget startar och varje flik ritas, menyn, flikarna och tangentbordet, startytan,
// demot, interna fel och gränssnittets språk.
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow, delatFonster, delatFlikfonster, MENYFLIKAR, tillstandsavtryck, utgangslage } from './helpers/app-harness.js';
import { las, papa, vanta, csvFil, braRader } from './helpers/granssnitt-rigg.js';

// Ett delat fönster med demodatan där varje flik i menyn har klickats fram en gång (det dyra är att rita flikarna), för
// testerna som söker igenom alla flikar. Vakten i delatFonster fäller det test som ändrar fönstret.
const allaFlikar = delatFonster(async w => {
    w.__loadDemoData();
    [...w.document.querySelectorAll('.nav-item[data-tab]')].forEach(b => { if (!b.disabled && !b.hidden) b.click(); });
    await new Promise(r => setTimeout(r, 0));
});

// Testerna som söker igenom flikarna läser kopior av varje flik ur ett delat fönster (delatFlikfonster).
// Vakten i delatFonster fäller det test som ändrar fönstret.
const { flikfonster, ritade } = delatFlikfonster();

// Fönstret skapas efter de delade fönstren ovan: bootskärmen tas bort med en timer, och testet av mallstilarna
// förutsätter att den hunnit försvinna.
let win;

beforeAll(() => {
    win = createAppWindow();
});

describe('#1 röktest: boot', () => {
    it('det delade fönstret står i utgångsläget', () => {
        expect(utgangslage(win)).toEqual({ troskel: 10, dialoger: 0, flik: 'dashboard' });
    });

    it('vakten ser en ändrad tröskel, en öppen dialog och ett ändrat tillstånd, men inte en ritad flik', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const fore = JSON.stringify(tillstandsavtryck(w));
        w.document.querySelector('.nav-item[data-tab="struktur"]').click();
        expect(JSON.stringify(tillstandsavtryck(w))).toBe(fore);
        w.eval('openGlossary()');
        w.eval('sattKTroskel(25, { fraga: false })');
        expect(utgangslage(w)).toEqual({ troskel: 25, dialoger: 1, flik: 'struktur' });
        const andrat = tillstandsavtryck(w), bas = JSON.parse(fore);
        expect(Object.keys(andrat).filter(k => andrat[k] !== bas[k])).toEqual(['dialoger', 'kTroskel']);
        w.__state.data[0].lon = 1;
        expect(tillstandsavtryck(w).data).not.toBe(bas.data);
    });

    it('app.js bootar utan kast och exponerar nyckel-API', () => {
        expect(win.__bootErr).toBeUndefined();
        expect(typeof win.__renderTabContent).toBe('function');
        expect(typeof win.__state).toBe('object');
        expect(typeof win.__loadDemoData).toBe('function');
        expect(typeof win.__methodAppendixData).toBe('function');
    });

    it('storage-tripwire är aktiv (kastar vid icke-tillåten skrivning)', () => {
        expect(() => win.eval("localStorage.setItem('x','y')")).toThrow();
    });

    it('process-tracker renderas redan vid boot (utan data) med steg 1 ej klart', () => {
        // Boot-koden i 61-regler-och-praxis.js kör renderProcessTracker() — kortet ska
        // finnas ÄVEN innan data laddats (demo laddas i ett senare describe-block).
        const host = win.document.getElementById('process-tracker');
        expect(host).toBeTruthy();
        expect(host.innerHTML).toContain('Kartläggningens steg');
        const rows = host.querySelectorAll('.ptrack-row');
        expect(rows.length).toBe(9);                       // nio steg (Rapporttext är steg 7)
        expect(rows[0].querySelector('.ptrack-status').dataset.status).toBe('ej'); // steg 1 ej klart utan data
        expect(host.innerHTML).toContain('data-goto-tab');  // klickbara länkar (CSP-säkra)
        expect(host.innerHTML).not.toContain('onclick');    // inga inline-handlers (hash-CSP)
    });
});

describe('#1 röktest: demodata + full pipeline', () => {
    it('loadDemoData kör hela pipelinen utan kast', () => {
        expect(() => win.__loadDemoData()).not.toThrow();
        expect(win.__state.data.length).toBe(260);   // självdiagnostikens 200 + tre yrken i BAS C (kandidatpar)
        expect(win.__state.isDemo).toBe(true);
    });

    it('#9 demo-banner blir synlig', () => {
        expect(win.document.getElementById('demo-mode-banner').style.display).toBe('flex');
    });
});

describe('process-tracker: statusar härleds ur inläst data', () => {
    it('steg 1 blir klart (✅) och likvärdighetsraden visar kandidatpar-antal efter demodata', () => {
        win.__renderProcessTracker();
        const host = win.document.getElementById('process-tracker');
        const rows = host.querySelectorAll('.ptrack-row');
        expect(rows.length).toBe(9);
        expect(rows[0].querySelector('.ptrack-status').dataset.status).toBe('klar');   // underlag inläst
        expect(rows[0].textContent).toContain('260');                              // 260 demo-rader
        // Steg 4 (likvärdigt arbete) visar antal kandidatpar. Rubriken är på
        // klarspråk sedan copy-översynen — lagrum ligger i tooltip/detaljtext.
        expect(rows[3].textContent).toMatch(/Likvärdigt arbete/);
        expect(rows[3].textContent).toMatch(/kandidatpar/);
    });

    it('regler & praxis-raden speglar antal ifyllda bedömningar (0/6 → 1/6)', () => {
        // nollställ, rendera → 0/6
        for (let i = 1; i <= 6; i++) { const s = win.document.getElementById('bes8-status-' + i); if (s) s.value = ''; }
        win.__renderProcessTracker();
        let bes8Row = [...win.document.querySelectorAll('#process-tracker .ptrack-row')].find(r => /Regler & praxis/.test(r.textContent));
        expect(bes8Row.textContent).toContain('0/6');

        // fyll ett område → 1/6
        win.document.getElementById('bes8-status-1').value = 'Åtgärd krävs';
        win.__renderProcessTracker();
        bes8Row = [...win.document.querySelectorAll('#process-tracker .ptrack-row')].find(r => /Regler & praxis/.test(r.textContent));
        expect(bes8Row.textContent).toContain('1/6');
        expect(bes8Row.querySelector('.ptrack-status').dataset.status).toBe('delvis');   // delvis
        win.document.getElementById('bes8-status-1').value = '';                    // städa
    });

    it('steg 6 (samverkan), 7 (rapporttext) och 8 (dokumentation) är manuella (➖)', () => {
        win.__renderProcessTracker();
        const rows = [...win.document.querySelectorAll('#process-tracker .ptrack-row')];
        const samverkan = rows.find(r => /Samverkan/.test(r.textContent));
        const dok = rows.find(r => /Dokumentation/.test(r.textContent));
        const text = rows.find(r => /Rapporttext/.test(r.textContent));
        expect(text.querySelector('.ptrack-status').dataset.status).toBe('manuell');
        expect(samverkan.querySelector('.ptrack-status').dataset.status).toBe('manuell');
        expect(dok.querySelector('.ptrack-status').dataset.status).toBe('manuell');
    });
});

describe('#1 röktest: varje flik renderar utan kast', () => {
    const tabs = ['rapport', 'kon', 'demografi', 'benchmark', 'matrix',
        'prioritering', 'struktur', 'loneoversyn', 'likvardighet', 'utforska', 'benchmark', 'kvalitet', 'info'];
    it.each(tabs)('renderTabContent("%s")', (t) => {
        expect(() => win.__renderTabContent(t)).not.toThrow();
    });

    // CSP:n har style-src-attr 'none' (ADR-30): ett element får bara bära de stilar som skript sätter via CSSOM —
    // synlighet, läge och uträknade mått — aldrig en layoutstil ur en mall. (Den statiska vakten, tests/sakerhet.test.js,
    // håller mallarna rena; här kontrolleras det som faktiskt ritats på demodata i alla flikar.)
    it('inget element i dokumentet bär en stil som en mall skrivit (bara display, bredd, läge, synlighet, färg som skript sätter)', () => {
        const TILLATNA = new Set(['display', 'width', 'left', 'top', 'bottom', 'margin-left', 'margin-top', 'visibility', 'opacity', 'position', 'color', 'transition']);
        const d = win.document;
        const fynd = [];
        for (const t of tabs) {
            win.__renderTabContent(t);
            for (const el of d.querySelectorAll('[style]')) {
                if (el.closest('svg')) continue;
                for (let i = 0; i < el.style.length; i++) {
                    const egenskap = el.style[i];
                    if (!TILLATNA.has(egenskap)) fynd.push(`${t}: <${el.tagName.toLowerCase()} class="${el.className}"> ${egenskap}`);
                }
            }
        }
        expect([...new Set(fynd)]).toEqual([]);
    });
    it('staplar med data-stil-* har fått sitt mått via CSSOM efter ritning', () => {
        const d = win.document;
        const saknas = [];
        // CSSOM läser tillbaka ett tal med sex värdesiffror, som Chromium och Firefox: "4.166666666666667%" blir
        // "4.16667%". Måttet jämförs därför med vad samma värde blir när det sätts i en tom stil.
        const tom = d.createElement('span').style;
        const somSatt = (egenskap, varde) => { tom[egenskap] = ''; tom[egenskap] = varde; return tom[egenskap] || 'saknas'; };
        for (const t of tabs) {
            win.__renderTabContent(t);
            for (const el of d.querySelectorAll('[data-stil-bredd]')) if (el.style.width !== somSatt('width', el.getAttribute('data-stil-bredd'))) saknas.push(`${t}: ${el.className}`);
            for (const el of d.querySelectorAll('[data-stil-vanster]')) if (el.style.left !== somSatt('left', el.getAttribute('data-stil-vanster'))) saknas.push(`${t}: ${el.className}`);
            for (const el of d.querySelectorAll('[data-stil-mvanster]')) if (el.style.marginLeft !== somSatt('marginLeft', el.getAttribute('data-stil-mvanster'))) saknas.push(`${t}: ${el.className}`);
        }
        expect(saknas).toEqual([]);
    });
});

describe('process-trackern och § 3:10', () => {
    it('process-trackern har nio steg och steg 9 är manuellt (➖)', () => {
        win.__renderProcessTracker();
        const rows = [...win.document.querySelectorAll('#process-tracker .ptrack-row')];
        expect(rows.length).toBe(9);
        const step9 = rows[8];
        expect(step9.querySelector('.ptrack-status').dataset.status).toBe('manuell');
        expect(step9.textContent).toMatch(/Uppföljning/);
    });

    it('§ 3:10 och A/B-scenariojämförelsen ritas utan fel', () => {
        win.__loadDemoData();
        expect(() => win.__renderTabContent('likvardighet')).not.toThrow();
        expect(typeof win.__computeLikvardighetPairs).toBe('function');
        expect(typeof win.eval('_lvParFigur')).toBe('function');
    });
});

describe('a11y: ARIA APG-tangentbord i den in-page-tablisten', () => {
    // Sidopanelen är navigation (ADR-10) och omfattas INTE — den har alla knappar
    // i Tab-ordningen med flit. Det här gäller info-sektionerna och underflikarna i Tabeller och egna vyer (samma
    // klasser, 74-alla-diagram.js), som är äkta tablists.
    const listor = [
        ['info-sektionerna', '#view-info .info-section-btn', () => win, 'info'],
        ['underflikarna i Tabeller och egna vyer', '[data-ut-underflik]', () => win, 'utforska']
    ];

    for (const [namn, sel, fonster, flik] of listor) {
        it(`${namn}: exakt en knapp ligger i Tab-ordningen (roving tabindex)`, () => {
            const btns = [...fonster().document.querySelectorAll(sel)];
            expect(btns.length).toBeGreaterThan(1);
            expect(btns.filter(b => b.tabIndex === 0).length).toBe(1);
            expect(btns.every(b => b.tabIndex === 0 || b.tabIndex === -1)).toBe(true);
        });

        it(`${namn}: högerpil flyttar aktiv flik, fokus och tabindex`, () => {
            fonster().document.querySelector(`.nav-item[data-tab="${flik}"]`).click();
            const btns = [...fonster().document.querySelectorAll(sel)];
            const från = btns.findIndex(b => b.tabIndex === 0);
            const till = (från + 1) % btns.length;
            btns[från].dispatchEvent(new (fonster().KeyboardEvent)('keydown', { key: 'ArrowRight', bubbles: true }));
            expect(btns[till].classList.contains('active'), 'nästa flik ska bli aktiv').toBe(true);
            expect(btns[till].getAttribute('aria-selected')).toBe('true');
            expect(btns[från].getAttribute('aria-selected')).toBe('false');
            expect(btns[till].tabIndex).toBe(0);
            expect(btns[från].tabIndex).toBe(-1);
            expect(fonster().document.activeElement).toBe(btns[till]);
        });

        it(`${namn}: vänsterpil wrappar runt till sista fliken`, () => {
            const btns = [...fonster().document.querySelectorAll(sel)];
            const första = btns[0];
            första.click();
            expect(första.tabIndex).toBe(0);
            första.dispatchEvent(new (fonster().KeyboardEvent)('keydown', { key: 'ArrowLeft', bubbles: true }));
            expect(btns[btns.length - 1].classList.contains('active')).toBe(true);
        });

        it(`${namn}: End går till sista, Home till första`, () => {
            const btns = [...fonster().document.querySelectorAll(sel)];
            const aktiv = () => btns.findIndex(b => b.tabIndex === 0);
            btns[aktiv()].dispatchEvent(new (fonster().KeyboardEvent)('keydown', { key: 'End', bubbles: true }));
            expect(aktiv()).toBe(btns.length - 1);
            btns[aktiv()].dispatchEvent(new (fonster().KeyboardEvent)('keydown', { key: 'Home', bubbles: true }));
            expect(aktiv()).toBe(0);
        });
    }

    it('sidopanelens navigationsknappar är kvar i Tab-ordningen (ADR-10)', () => {
        // Regressionsskydd: roving tabindex togs BORT ur sidopanelen med flit.
        const nav = [...win.document.querySelectorAll('.nav-item')];
        expect(nav.length).toBeGreaterThan(1);
        expect(nav.some(b => b.tabIndex === -1), 'ingen nav-knapp ska tas ur Tab-ordningen').toBe(false);
    });
});

describe('demoläget märker även tabellernas CSV', () => {
    it('filnamnet får DEMO_ i demoläget, men bara en gång', () => {
        const w = createAppWindow();
        expect(w.__csvFilnamn('utforska')).toBe('utforska');
        w.__loadDemoData();
        expect(w.__csvFilnamn('utforska')).toBe('DEMO_utforska');
        expect(w.__csvFilnamn('DEMO_Utforska_Median_2026-09-25')).toBe('DEMO_Utforska_Median_2026-09-25');
    });
});

// Paragrafhänvisningar ("§ 9", "DiskrL 3:8", "3 kap.", "art. 9") hör till hjälptexten
// — fliken Om verktyget, ordlistan, tooltips, "Hur används denna flik", förklarings-
// rutor och hjälpmodaler — inte till menyer, rubriker och löptext i gränssnittet.
// Exporterna (Excel/Word/PDF/JPA) omfattas inte.
describe('gränssnittet har inga paragrafhänvisningar utanför hjälptexten', () => {
    it('ingen synlig text i flikarna hänvisar till paragrafer eller artiklar', () => {
        // Alla flikar i menyn är ritade, också Filer och kvalitet, Rapporttext och Spara och jämför år.
        const w = allaFlikar();
        const hjalp = '#view-info, .flik-usage, .bakgrund-panel, .lv-hjalp, #gdpr-info-modal, #glossary-modal, #symbols-modal, '
            + '#data-residency-modal, #evidence-modal, script, style, noscript';
        const traffar = [];
        const walker = w.document.createTreeWalker(w.document.body, 4 /* NodeFilter.SHOW_TEXT */);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (n.parentElement && n.parentElement.closest(hjalp)) continue;
            if (/§|DiskrL|kap\. ?3|3 kap\. ?\d|\b[Aa]rt\. ?\d|[Ll]agen \d+:\d+/.test(n.textContent)) {
                traffar.push(`${(n.parentElement.closest('[id]') || {}).id}: ${n.textContent.trim().slice(0, 70)}`);
            }
        }
        expect(traffar).toEqual([]);
    });
});

describe('menystruktur', () => {
    let w;
    beforeAll(() => { w = createAppWindow(); w.__loadDemoData(); });
    const flikar = () => [...w.document.querySelectorAll('.nav-item[data-tab]')].filter(b => !b.hidden).map(b => b.dataset.tab);
    const klicka = tab => w.document.querySelector(`.nav-item[data-tab="${tab}"]`).click();
    const synlig = id => w.document.getElementById(id).style.display === 'block';

    // Menyns ordning: struktur-flikar.test.js.
    it('Ålder & karriär: kohortförbehållet står under livscykelkurvorna, i Om verktygets metodtext och i metodbilagan', () => {
        klicka('kon');
        expect(w.document.getElementById('lifecycle-chart')).not.toBeNull();
        expect(w.document.querySelector('#livscykel-content .livscykel-kohort-not').textContent).toMatch(/tvärsnitt.*inte hur en persons lön utvecklas/);
        expect(w.document.getElementById('kon-kohort-not').textContent).toMatch(/tvärsnitt/);
        w.eval("renderInfoTab('metodik')");
        expect(w.document.getElementById('view-info').textContent).toMatch(/tvärsnitt.*kohorteffekter/);
        expect(w.eval('_methodAppendixData()').find(r => r[0] === 'Ålder & karriär (tvärsnitt)')[1]).toMatch(/tvärsnitt.*kohorteffekter/);
    });
    it('flikar med flera paneler visar alla sina paneler', () => {
        klicka('kon');
        ['view-kon', 'view-demografi', 'view-livscykel'].forEach(id => expect(synlig(id)).toBe(true));
        klicka('utforska');
        ['view-rapport', 'view-utforska'].forEach(id => expect(synlig(id)).toBe(true));
        klicka('dokumentera');
        ['view-kvalitet', 'view-dokumentera'].forEach(id => expect(synlig(id)).toBe(true));
    });
    it('Exportera innehåller export och JPA, Spara och jämför år inställningarna; Översikt inte', () => {
        const dok = w.document.getElementById('view-dokumentera');
        ['export-hub', 'btn-hub-jpa']
            .forEach(id => expect(dok.contains(w.document.getElementById(id)), id).toBe(true));
        expect(w.document.getElementById('view-arbetet').contains(w.document.getElementById('btn-config-save'))).toBe(true);
        const oversikt = w.document.getElementById('view-dashboard');
        expect(oversikt.contains(w.document.getElementById('export-hub'))).toBe(false);
    });
    it('flikmålen rapport, demografi och kvalitet leds till sina flikar', () => {
        w.eval("navigateTo('rapport')");     expect(synlig('view-rapport') && synlig('view-utforska')).toBe(true);
        w.eval("navigateTo('demografi')");   expect(synlig('view-demografi')).toBe(true);
        w.eval("navigateTo('kvalitet')");    expect(synlig('view-dokumentera')).toBe(true);
        const a = w.document.createElement('button'); a.setAttribute('data-goto-tab', 'kvalitet');
        w.document.body.appendChild(a); a.click(); a.remove();
        expect(synlig('view-dokumentera')).toBe(true);
    });
    it('alla länkmål i processkarta, åtgärdslista och iakttagelser pekar på en flik som finns', () => {
        klicka('dashboard');
        const mal = [...w.document.querySelectorAll('[data-goto-tab],[data-go-to-tab],[data-flow-tab]')]
            .map(e => e.getAttribute('data-goto-tab') || e.getAttribute('data-go-to-tab') || e.getAttribute('data-flow-tab'));
        const finns = new Set(flikar().concat(['benchmark']));
        mal.forEach(m => expect(finns.has(w.eval(`tabMal(${JSON.stringify(m)})`)), m).toBe(true));
    });
    it('processkartan har 9 steg under menyns faser: Samverkan under Åtgärder, Rapporttext först under Rapport', () => {
        w.__renderProcessTracker();
        const host = w.document.getElementById('process-tracker');
        // Faserna och stegen i den ordning de står: varje fasrubrik följs av sina steg.
        const faser = {}; let fas = null;
        for (const el of host.querySelectorAll('.ptrack-fas, .ptrack-row')) {
            if (el.classList.contains('ptrack-fas')) { fas = el.textContent.trim(); faser[fas] = []; continue; }
            faser[fas].push(el.querySelector('.fw-600').textContent.trim());
        }
        expect(faser).toEqual({
            '1 · Underlag': ['1. Underlag inläst', '2. Regler & praxis'],
            '2 · Kartläggning': ['3. Lika arbete — samma AID-etikett', '4. Likvärdigt arbete'],
            '3 · Åtgärder': ['5. Handlingsplan', '6. Samverkan med facket'],
            '4 · Rapport': ['7. Rapporttext', '8. Dokumentation', '9. Uppföljning av handlingsplanen'],
        });
        const rows = [...host.querySelectorAll('.ptrack-row')], mal = r => r.querySelector('[data-goto-tab]').getAttribute('data-goto-tab');
        expect(rows.map(mal)).toEqual(['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'handlingsplan', 'handlingsplan', 'rapporttext', 'dokumentera', 'dokumentera']);
        // Samverkan leder till kortet Samverkan och uppföljning i Handlingsplan.
        expect(rows[5].querySelector('[data-goto-tab]').getAttribute('data-goto-avsnitt')).toBe('hp-samverkan');
        const kort = w.document.getElementById('hp-samverkan');
        expect(kort.closest('#view-handlingsplan')).not.toBeNull();
        expect(kort.querySelector('h2').textContent).toBe('Samverkan och uppföljning');
        expect(rows[6].querySelector('.ptrack-status').dataset.status).toBe('manuell');
    });
    it('"Gå till steget" för Samverkan öppnar Handlingsplan och går till kortet', () => {
        w.__renderProcessTracker();
        const knapp = [...w.document.querySelectorAll('#process-tracker [data-goto-avsnitt]')][0];
        const kort = w.document.getElementById('hp-samverkan');
        let rullad = false; kort.scrollIntoView = () => { rullad = true; };
        knapp.click();
        expect(w.document.querySelector('.nav-item[data-tab="handlingsplan"]').classList.contains('active')).toBe(true);
        expect(rullad).toBe(true);
    });
    it('"Nästa steg" från Handlingsplan leder till Rapporttext', () => {
        klicka('handlingsplan');
        expect(w.document.querySelector('.flow-next-bar [data-flow-tab]').getAttribute('data-flow-tab')).toBe('rapporttext');
    });
    it('Löneläget syns efter statistikuppladdning och låses vid rensning', () => {
        w.__state.statistik = [{ aid: '1', bas: 'A', median: 30000 }];
        w.eval('_visaJamforelseFlik(true)');
        expect(w.document.querySelector('.nav-item[data-tab="benchmark"]').hidden).toBe(false);
        w.__clearAllData();
        expect(w.document.querySelector('.nav-item[data-tab="benchmark"]').getAttribute('aria-disabled')).toBe('true');
    });
});

describe('utfällt som standard', () => {
    // Hjälppaneler förblir infällda; explore-urval-val är Utforskas rullgardin för värdeval och diagram-urval-lista
    // diagramkärnans lista med kryssrutor ("Räkna för sektor", "Yrkesgrupp"), diagram-filter diagramkärnans rad
    // "Filter: …" med filterraderna och gu-andra valet av förklaringsvariabler under trappan i Var uppstår
    // löneskillnaden? ("Ändra uppdelning") — kontroller, inte grupperingar.
    const HJALP = ['flik-usage', 'audit-panel', 'bakgrund-panel', 'explore-urval-val', 'diagram-urval-lista', 'diagram-filter', 'gu-andra'];
    // Organisationspaketets förklaring (Vad är ett organisationspaket?) och formuläret för systemägaren är hopfällda i
    // steg 1 i Filer och kvalitet, och Underlagets kvalitet är ihopfälld när allt är OK (utfälld vid varning).
    // Livscykelns tabell per BAS-intervall och modelljämförelsen är modellens underlag, inte beskedet, och hopfällda.
    const UNDANTAG_ID = ['paket-vad', 'paket-skapa', 'uk-fallbar', 'livscykel-bas-tabell', 'livscykel-modelljamforelse'];
    it('varje <details> är utfälld utom hjälppanelerna — i markup och efter rendering av alla flikar', () => {
        const w = allaFlikar();
        const infallda = [...w.document.querySelectorAll('details:not([open])')]
            // Flikens avsnitt (details.avsnitt): slutsatserna och det FÖRSTA avsnittet är öppna, resten fälls
            // ut av användaren.
            .filter(d => !HJALP.some(k => d.classList.contains(k)) && !UNDANTAG_ID.includes(d.id) && !d.classList.contains('avsnitt'))
            .map(d => (d.id || d.className || '') + ' :: ' + (d.querySelector('summary')?.textContent || '').trim().slice(0, 50));
        expect(infallda).toEqual([]);
    });
    it('flikens avsnitt: det första är öppet, och ett hopfällt avsnitt är ändå ritat (exporterna läser tabellerna)', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        // Per flik i den nya formen: det första avsnittet öppet, övriga hopfällda.
        // Lönestruktur har ett avsnitt utan flikens prefix först (Var uppstår löneskillnaden?, avsnitt-ov-gap): där läses fliken.
        for (const [prefix, forsta] of [['avsnitt-la-', 'avsnitt-la-yrkesgrupper'], ['avsnitt-ak-', 'avsnitt-ak-karriar'], ['avsnitt-ar-', 'avsnitt-ar-konfiguration'],
                ['#view-struktur', 'avsnitt-ov-gap'], ['avsnitt-lo-', 'avsnitt-lo-riktade']]) {
            const flikens = [...w.document.querySelectorAll(prefix.startsWith('#') ? `${prefix} details.avsnitt` : `details.avsnitt[id^="${prefix}"]`)];
            // Prefixet säger fliken: inget av de här avsnitten står i Rapporttext (dess avsnitt bär prefixet rt-).
            expect(flikens.filter(a => a.closest('#view-rapporttext')).map(a => a.id), prefix).toEqual([]);
            expect(flikens.length, prefix).toBeGreaterThanOrEqual(4);
            expect(flikens[0].id).toBe(forsta);
            expect(flikens.map(a => a.open), prefix).toEqual([true, ...flikens.slice(1).map(() => false)]);
        }
        const avsnitt = [...w.document.querySelectorAll('details.avsnitt')];
        // Hopfällda, men ritade: tabellerna har rader och regressionskortet har innehåll (de står i Lönestruktur).
        w.document.querySelector('.nav-item[data-tab="struktur"]').click();
        expect(w.document.querySelectorAll('#paygap-table tbody tr').length).toBeGreaterThan(0);
        expect(w.document.querySelectorAll('#skevhet-table tbody tr').length).toBeGreaterThan(0);
        expect(w.document.getElementById('regression-card').textContent.length).toBeGreaterThan(100);
        // Varje avsnitt har en rubrik i sin sammanfattning.
        for (const a of avsnitt) expect(a.querySelector(':scope > summary h2, :scope > summary h3'), a.id).not.toBeNull();   // h3 för avsnitt inne i ett kort (Regler & praxis)
    });
});

// Ålder är valfri i lönefilen (ADR-64): utan ålder är Ålder & karriär låst med ett eget skäl.
describe('menyn låser Ålder & karriär utan ålder i lönefilen', () => {
    const utanAlder = w => { w.__state.data = w.__state.data.map(r => ({ ...r, alder: 0 })); w.eval('unlockTabs()'); };
    it('fliken är låst med tipset, klicket leder till lönefilskortet med skälet, och funktionssöket säger detsamma', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const kon = w.document.getElementById('tab-kon');
        expect(kon.getAttribute('aria-disabled')).toBeNull();
        utanAlder(w);
        expect(w.eval('harAlder()')).toBe(false);
        expect(kon.getAttribute('aria-disabled')).toBe('true');
        expect(kon.getAttribute('title')).toBe('Kräver ålder i lönefilen');
        // De andra flikarna är öppna.
        for (const id of ['tab-matrix', 'tab-struktur', 'tab-prioritering']) expect(w.document.getElementById(id).getAttribute('aria-disabled'), id).toBeNull();
        kon.click();
        expect(w.document.getElementById('view-filer').style.display).toBe('block');
        expect(w.document.getElementById('view-kon').style.display).not.toBe('block');
        await new Promise(r => setTimeout(r, 80));
        expect(w.document.getElementById('aria-live-announcer').textContent).toMatch(/kräver ålder i lönefilen/);
        expect(w.eval("_sokKraver({ flik: 'kon' })")).toBe('alder');
        // Översiktens medelålder är tom.
        w.eval('updateDashboardStats()');
        expect(w.document.getElementById('stat-age').textContent).toBe('–');
    });
    it('med ålder igen låses fliken upp och får sitt eget tips', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const med = w.__state.data;
        utanAlder(w);
        w.__state.data = med;
        w.eval('unlockTabs()');
        const kon = w.document.getElementById('tab-kon');
        expect(kon.getAttribute('aria-disabled')).toBeNull();
        expect(kon.getAttribute('title')).toBe(kon.getAttribute('data-tip'));
        expect(kon.dataset.kraver).toBeUndefined();
    });
});

describe('interna fel syns i stället för att sväljas', () => {
    it('ett fel i en del av Att göra hoppar över delen, men rapporteras och visas', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const varningar = [];
        w.console.warn = (...a) => varningar.push(a.join(' '));
        w.eval("likvardighetResultat = () => { throw new Error('trasigt 203020 och 36725'); }");
        const punkter = w.eval('buildActionChecklist()');
        expect(punkter.length).toBeGreaterThan(0);                              // resten av listan finns kvar
        expect(w.__state._interntFel.map(f => f.plats)).toContain('Att göra: likvärdigt arbete');
        const banner = w.document.getElementById('internt-fel-banner');
        expect(banner.hidden).toBe(false);
        expect(banner.textContent).toMatch(/Att göra: likvärdigt arbete/);
        expect(banner.textContent).toMatch(/ofullständigt/);
        expect(varningar.join('\n')).toMatch(/Att göra: likvärdigt arbete/);
        expect(varningar.join('\n')).not.toMatch(/\d/);                          // inga siffror (kan vara data) i konsolen
        w.__clearAllData();
        expect(banner.hidden).toBe(true);
        expect(w.__state._interntFel).toEqual([]);
    });
    it('vid normal körning av demot med alla flikar uppstår inga interna fel', async () => {
        const w = createAppWindow();
        w.__loadDemoData();
        for (const t of ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn',
            'handlingsplan', 'dokumentera', 'kon', 'utforska', 'benchmark', 'info']) w.__renderTabContent(t);
        await new Promise(r => setTimeout(r, 300));
        expect(w.__state._interntFel || []).toEqual([]);
        expect(w.document.getElementById('internt-fel-banner').hidden).toBe(true);
    });
});

describe('demot och testdatan har riktiga AID-koder', () => {
    it('varje AID i demot finns i etikettlistan', async () => {
        const { etikett } = await import('../src/lib/aid.js');
        const w = createAppWindow();
        w.__loadDemoData();
        const okanda = [...new Set(w.__state.data.map(r => r.aid))].filter(a => !etikett(a));
        expect(okanda).toEqual([]);
    });
    it('varje AID i den syntetiska testdatan finns i etikettlistan', async () => {
        const { etikett } = await import('../src/lib/aid.js');
        const { byggTestCsv } = await import('../tools/lib/testdata.mjs');
        const koder = [...new Set(byggTestCsv(400).trim().split('\n').slice(1).map(r => r.split(';')[2].split(' ')[0]))];
        expect(koder.filter(a => !etikett(a))).toEqual([]);
    });
});

describe('organisationsneutralt standardläge', () => {
    const rader = () => {
        const r = [];
        for (let i = 0; i < 60; i++) r.push({ bas: 'ABC'[i % 3], kon: i % 2 ? 'man' : 'kvinna', lon: 30000 + i * 150, alder: 30 + (i % 30),
            yrke: `${100 + (i % 4)} Yrke`, aid: String(100 + (i % 4)), yrkeLabel: 'Yrke', radnr: i + 2 });
        return r;
    };
    const utanReferens = () => {
        const w = createAppWindow();
        w.__state.data = rader();
        w.eval('populateSelects(); unlockTabs(); updateCompliance();');
        return w;
    };
    it('ingen inbyggd referens och neutral profil', () => {
        const w = createAppWindow();
        expect(w.__state.policy).toEqual([]);
        expect(w.eval('referensNamn()')).toBe('Ingen referens inläst');
        expect(w.document.getElementById('referens-status').textContent).toContain('Ingen referens inläst');
        expect(w.__state.profile.name).toBe('Organisationen');
        expect(w.__state.profile.benchmarkLabel).toBe('jämförelsestatistiken');
        expect(w.document.getElementById('profile-preset-select')).toBeNull();
    });
    it('Prioritering och Lönepolitik visar vad som behöver läsas in', () => {
        const w = utanReferens();
        w.document.querySelector('.nav-item[data-tab="prioritering"]').click();
        expect(w.document.getElementById('view-prioritering').textContent).toMatch(/Läs in organisationens lönepolitiska ställningstagande/);
        w.__renderTabContent('benchmark');
        expect(w.document.getElementById('avsnitt-jmf-stallningstagande').textContent).toMatch(/Läs in organisationens lönepolitiska ställningstagande/);
        expect(w.document.getElementById('comp-pol-val').textContent).toMatch(/Kräver lönepolitiskt ställningstagande/);
    });
    it('Word-utkastet och rapportunderlaget skriver inte null eller undefined utan referens', () => {
        const w = utanReferens();
        const texter = [w.__docDraftHtml(), ...w.__rapportunderlagBlock().map(b => w.__ruTillText(b))].join('\n');
        expect(texter).not.toMatch(/\bnull\b|\bundefined\b/);
    });
    it('demoläget använder Exempelkommunen och försvinner med rensningen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        expect(w.eval('referensNamn()')).toBe('Exempelkommunens lönepolitik');
        expect(w.__state.policy.length).toBeGreaterThan(0);
        expect(w.__state.profile.name).toBe('Exempelkommunen');
        w.__clearAllData();
        expect(w.__state.policy).toEqual([]);
        expect(w.__state.profile.name).toBe('Organisationen');
        expect(w.eval('referensNamn()')).toBe('Ingen referens inläst');
    });
});

describe('Om verktyget: licens', () => {
    it('avsnittet Referenser anger MIT-licensen och upphovspersonen', () => {
        const w = createAppWindow();
        w.document.querySelector('.nav-item[data-tab="info"]').click();
        w.eval("renderInfoTab('references')");
        const t = w.document.getElementById('view-info').textContent;
        expect(t).toMatch(/MIT-licensen/);
        expect(t).toContain('Felix Jansson');
    });
    it('Om verktyget berättar om nuläget, inte om tidigare versioner', () => {
        const w = createAppWindow();
        w.document.querySelector('.nav-item[data-tab="info"]').click();
        const sektioner = [...w.document.querySelectorAll('.info-section-btn')].map(b => b.dataset.section);
        expect(sektioner.length).toBeGreaterThan(0);
        let text = '';
        for (const s of sektioner) {
            w.eval(`renderInfoTab(${JSON.stringify(s)})`);
            text += w.document.getElementById('info-tab-content').textContent + '\n';
        }
        expect(text).not.toMatch(/Versionshistorik/);
        expect(text).not.toMatch(/Tidigare visades/);
        expect(text).not.toMatch(/äldre profile\.json/);
        expect(text).not.toMatch(/SKL/);
    });
});

describe('demosidan: adressparametern ?demo=1', () => {
    it('?demo=1 startar demoläget direkt vid laddning', () => {
        const w = createAppWindow({ url: 'http://localhost/oppen-lonekartlaggning.html?demo=1' });
        expect(w.__bootErr).toBeUndefined();
        expect(w.__state.isDemo).toBe(true);
        expect(w.__state.data.length).toBe(260);
    });
    it('utan parametern, eller med ett annat värde, laddas ingen data', () => {
        for (const url of ['http://localhost/', 'http://localhost/?demo=0', 'http://localhost/?demo=ja', 'http://localhost/?data=1']) {
            const w = createAppWindow({ url });
            expect(w.__state.data.length, url).toBe(0);
            expect(w.__state.isDemo, url).toBeFalsy();
        }
    });
});

describe('demot: ställningstagandet följer demolönerna', () => {
    it('några grupper ligger under ställningstagandet, så att Prioritering har något att visa', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.__renderTabContent('prioritering');
        expect(w.document.getElementById('view-prioritering').textContent).not.toMatch(/Inga grupper under referensen/);
    });
});

// Klarspråk, samma namn överallt, rubriker utan emoji och ett hjälpblock av varje slag
// per flik. Fackuttrycken får stå i hjälptexten.
describe('gränssnittets språk, rubriker och hjälpblock', () => {
    const HJALP = '#view-info, .flik-usage, .bakgrund-panel, .lv-hjalp, .audit-panel, #gdpr-info-modal, #glossary-modal, '
        + '#symbols-modal, #data-residency-modal, #evidence-modal, script, style, noscript, [data-hjalptext]';
    const synligText = (w, rot) => {
        const ut = [];
        const walker = w.document.createTreeWalker(rot, 4);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (n.parentElement && n.parentElement.closest(HJALP)) continue;
            if (n.textContent.trim()) ut.push({ id: (n.parentElement.closest('[id]') || {}).id, text: n.textContent.trim().slice(0, 80) });
        }
        return ut;
    };
    it('inga fackuttryck, engelska eller motsägelser i gränssnittet utanför hjälptexten', () => {
        const w = flikfonster();
        const traffar = [];
        const FORBJUDET = /Outlier|Pareto|[Qq]uantile|Boxplot|[Ss]napshot|Kompliansöversikt|Blinder-Oaxaca|[Mm]ultivariat|\bMetric\b|Z-score|Struktur-data|Datauppladdning|A–K\b/;
        for (const flik of MENYFLIKAR) {
            const { paneler: ritat, titel } = ritade.get(flik);
            const paneler = ritat.filter(v => v.style.display === 'block');
            for (const rad of paneler.flatMap(v => synligText(w, v))) {
                if (FORBJUDET.test(rad.text)) traffar.push(`${flik} › ${rad.id}: ${rad.text}`);
            }
            traffar.push(...(FORBJUDET.test(titel) ? [`${flik} › rubrik`] : []));
        }
        expect([...new Set(traffar)]).toEqual([]);
    });
    it('inga rubriker börjar med emoji', () => {
        const traffar = [];
        for (const flik of MENYFLIKAR) {
            for (const h of ritade.get(flik).paneler.flatMap(p => [...p.querySelectorAll('.view-panel h1, .view-panel h2, .view-panel h3, .view-panel h4, .view-panel summary')])) {
                if (h.closest('.view-panel').style.display !== 'block') continue;
                const t = h.textContent.trim();
                if (/^\p{Extended_Pictographic}/u.test(t)) traffar.push(`${flik} › ${t.slice(0, 50)}`);
            }
        }
        expect([...new Set(traffar)]).toEqual([]);
    });
    it('högst ett hjälpblock av varje slag per flik', () => {
        const traffar = [];
        for (const flik of MENYFLIKAR) {
            const synliga = sel => ritade.get(flik).paneler.flatMap(p => [...p.querySelectorAll(sel)]).filter(el => el.closest('.view-panel')?.style.display === 'block');
            // "Beräkning & urval" hör till varje enskild analys och får finnas en per analys.
            for (const [namn, sel] of [['Hur används', '.flik-usage'], ['Bakgrund', '.bakgrund-panel']]) {
                const n = synliga(sel).filter(el => namn !== 'Hur används' || /Hur används/.test(el.querySelector('summary')?.textContent || '')).length;
                if (n > 1) traffar.push(`${flik} › ${namn}: ${n}`);
            }
        }
        expect(traffar).toEqual([]);
    });
});

// A5: Prioriteringens förslag avfärdar inte en skillnad ("normal variation") och talar inte om utredning.
describe('förbjudna fraser i det byggda verktyget', () => {
    it('"normal variation" och "kräver ytterligare utredning" står inte i appen eller sidan', async () => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const rot = join(dirname(fileURLToPath(import.meta.url)), '..');
        for (const fil of ['dist/app.js', 'src/index.html']) {
            const text = readFileSync(join(rot, fil), 'utf8');
            expect(text, fil).not.toMatch(/normal variation/i);
            expect(text, fil).not.toMatch(/kräver ytterligare utredning/i);
        }
    });
});

describe('gränssnittet: flikarnas form, inställningar, sök och tomlägen', () => {
    const lasIn = async (w, rader) => {
        const { readFileSync } = await import('node:fs');
        const { join, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        w.eval(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'papaparse.min.js'), 'utf8'));
        w.loadStructureFile(new w.File([rader.join('\n')], 'p.csv', { type: 'text/csv' }));
        for (let i = 0; i < 100 && !w.__state.data.length; i++) await new Promise(r => setTimeout(r, 20));
    };
    it('användbarhetsgraden räknar inte avsiktligt uteslutna BAS; singular för en person', async () => {
        const w = createAppWindow();
        const rader = ['BAS;Månadslön;Ålder;Kön;AID'];
        for (let i = 0; i < 20; i++) rader.push(`A;${30000 + i};40;${i % 2 ? 'Man' : 'Kvinna'};5301`);
        rader.push('K;90000;50;Man;7101');
        await lasIn(w, rader);
        expect(w.document.getElementById('data-validation-report').textContent).toContain('Användbarhetsgrad: 100,0\u00a0%');
        expect(w.document.getElementById('data-status').textContent).toContain('21 rader');
    });
    it('kompliansrutan för referensens P10 räknar bara BAS med minst k personer', () => {
        const w = createAppWindow();
        const rader = [];
        for (let i = 0; i < 30; i++) rader.push({ bas: 'D', kon: i % 2 ? 'man' : 'kvinna', lon: 40000, alder: 40, yrke: '1 Y', aid: '1', enhet: '1000' });
        for (let i = 0; i < 3; i++) rader.push({ bas: 'C', kon: 'kvinna', lon: 20000, alder: 40, yrke: '2 Y', aid: '2', enhet: '1000' });
        w.__state.data = rader;
        w.eval('populateSelects(); unlockTabs();');
        w.__lasInReferens([{ bas: 'C', p10: 28300, med: 31700, p90: 35400 }, { bas: 'D', p10: 30000, med: 33900, p90: 37800 }], 'ref.csv');
        w.__updateCompliance();
        expect(w.document.getElementById('comp-pol-val').textContent).toMatch(/^0 av 1 BAS-intervall/);
    });
    it('Exportera har checklistan överst, robustheten och exporterna som lista; rapportunderlaget står i Rapporttext', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="dokumentera"]').click();
        // Alla flikens paneler ligger i innehållsytan (det tomma bandet överst kom av att de låg utanför).
        for (const id of ['view-kvalitet', 'view-dokumentera', 'view-rapporttext', 'view-arbetet', 'view-benchmark', 'view-utforska']) {
            expect(d.getElementById(id).parentElement.classList.contains('content-body'), id).toBe(true);   // har-sidindex kan stå bredvid
        }
        const fore = (a, b) => !!(d.getElementById(a).compareDocumentPosition(d.getElementById(b)) & 4);
        expect(fore('dk-slutsatser', 'fardigcheck-body') && fore('fardigcheck-body', 'avsnitt-dk-robusthet') && fore('avsnitt-dk-robusthet', 'export-hub')).toBe(true);
        expect([...d.querySelectorAll('#view-kvalitet details.avsnitt, #view-dokumentera details.avsnitt[id^="avsnitt-dk-"]')].map(a => a.id))
            .toEqual(['avsnitt-dk-robusthet']);
        expect(d.getElementById('avsnitt-dk-robusthet').open).toBe(true);
        // Slutsatserna: färdigcheckens punkter och robustheten (inte körd).
        const rutor = [...d.querySelectorAll('#dk-slutsatser .slutsats')].map(r => r.textContent);
        expect(rutor).toHaveLength(2);
        const punkter = d.querySelectorAll('#fardigcheck-body .fc-item').length;
        expect(rutor[0]).toContain(punkter ? `${punkter} punkt` : 'Inga lösa trådar');
        expect(rutor[1]).toContain('Inte körd');
        expect(d.getElementById('nyckel-dk-robusthet').textContent).toBe('Inte körd');
        // Rapportunderlaget ritas av Rapporttext och lämnar antalet avsnitt i sitt nyckeltal.
        d.querySelector('.nav-item[data-tab="rapporttext"]').click();
        const block = d.querySelectorAll('#rapportunderlag-innehall .ru-block:not(.ru-diagram)').length;
        expect(block).toBeGreaterThan(0);
        expect(d.getElementById('nyckel-dk-rapportunderlag').textContent).toBe(`${block} avsnitt`);
        d.querySelector('.nav-item[data-tab="dokumentera"]').click();
        // Inget i raden märks som fel: punkterna är observationer.
        expect(d.querySelectorAll('#dk-slutsatser .ar-kritisk')).toHaveLength(0);
        // Exporterna: en rad per underlag med en beskrivning och en knapp eller ett val.
        const rader = [...d.querySelectorAll('#export-hub .export-lista > .export-hub-row')];
        // Bara det som exporterar står som rader; flikarna med egna underlag är länkar i raden under listan.
        expect(rader).toHaveLength(6);
        expect(d.querySelectorAll('#export-hub [data-flow-tab]')).toHaveLength(0);
        expect(d.getElementById('export-hub').textContent).not.toContain('Öppna fliken');
        const fler = d.querySelector('#export-hub .export-fler');
        expect(fler.textContent).toMatch(/^Fler underlag finns i flikarna: Likvärdigt arbete \(kandidatparen\), Lönestruktur \(direktivets mått\), Prioritering \(åtgärdslistan\), Löneöversyn \(prognosen\)\.$/);
        expect([...fler.querySelectorAll('a[data-go-to-tab]')].map(a => a.dataset.goToTab)).toEqual(['likvardighet', 'struktur', 'prioritering', 'loneoversyn']);
        fler.querySelector('a[data-go-to-tab="prioritering"]').click();
        expect(d.querySelector('.nav-item.active').dataset.tab).toBe('prioritering');
        d.querySelector('.nav-item[data-tab="dokumentera"]').click();
        // Organisationens namn står i PDF-raden under beskrivningen och förklaringen (S9 i punkt 26), förifyllt och förklarat.
        const pdfRad = d.getElementById('btn-export-pdf').parentElement;
        const text = pdfRad.querySelector(':scope > div:first-child');
        expect(text.querySelector(':scope > .export-org #kl-org-name')).not.toBeNull();
        expect(text.querySelector('#kl-org-forklaring').compareDocumentPosition(text.querySelector('.export-org')) & 4).toBe(4);   // efter förklaringen
        expect(d.getElementById('kl-org-forklaring').textContent).toMatch(/försättsblad.*organisationspaketet/);
        expect(d.getElementById('kl-org-name').getAttribute('aria-describedby')).toBe('kl-org-forklaring');
        for (const r of rader) {
            expect(r.querySelector('strong').textContent.trim().length).toBeGreaterThan(2);
            expect(r.querySelector('span').textContent.trim().length).toBeGreaterThan(20);
            expect(r.querySelectorAll(':scope > button')).toHaveLength(1);
        }
        for (const id of ['btn-export-docdraft', 'btn-export-pdf', 'btn-export-all-excel', 'btn-export-zip', 'kl-org-name']) {
            expect(d.getElementById(id).closest('.export-lista'), id).not.toBeNull();
        }
    });
    it('robusthetsanalysen skriver sitt utfall i slutsatserna och i avsnittets nyckeltal; rensning tömmer raden', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="dokumentera"]').click();
        w.eval("_renderRobusthetResult(document.getElementById('robusthet-body'))");
        const rader = [...d.querySelectorAll('#robusthet-body tbody tr')];
        const flippar = d.querySelectorAll('#robusthet-body .rb-flip').length;
        const ruta = d.querySelectorAll('#dk-slutsatser .slutsats')[1].textContent;
        expect(ruta).toContain(flippar ? `${flippar} nära en gräns` : 'Står sig');
        expect(ruta).toContain(`${rader.length} slutsatser prövade`);
        expect(d.getElementById('nyckel-dk-robusthet').textContent).toBe(flippar ? `${flippar} nära en gräns` : 'Står sig');
        // Ny ritning av fliken nollställer robustheten: utfallet gäller de inställningar som rådde då.
        d.querySelector('.nav-item[data-tab="dokumentera"]').click();
        expect(d.querySelectorAll('#dk-slutsatser .slutsats')[1].textContent).toContain('Inte körd');
    });
    it('Struktur har slutsatserna först, sedan representationen och kartan; talen i toppen är tabellernas', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="struktur"]').click();
        const fore = (a, b) => !!(d.getElementById(a).compareDocumentPosition(d.getElementById(b)) & 4);
        expect(fore('st-urval', 'st-slutsatser') && fore('st-slutsatser', 'avsnitt-st-representation') && fore('avsnitt-st-representation', 'chart-struktur-tradkarta')).toBe(true);
        expect([...d.querySelectorAll('#view-struktur details.avsnitt[id^="avsnitt-st-"]')].map(a => a.id.replace('avsnitt-st-', '')))
            .toEqual(['representation', 'karta', 'fordelning', 'sektorer', 'eu', 'metod']);
        expect(d.querySelectorAll('.sidans-innehall')).toHaveLength(0);
        expect(d.getElementById('st-urval').textContent).toMatch(/260 personer.*Minsta gruppstorlek 10/);
        const rutor = [...d.querySelectorAll('#st-slutsatser .slutsats')].map(r => r.textContent);
        expect(rutor).toHaveLength(5);
        // Andelen kvinnor i kvartilerna står också i kvartiltabellen (sista kolumnen), och i samma form.
        const kvartiler = [...d.querySelectorAll('#struktur-eu table tbody tr')].map(tr => tr.textContent);
        const andel = t => t.match(/(\d+)\s%/)[0];
        expect(kvartiler[0]).toContain(andel(rutor[2]));
        expect(kvartiler[3]).toContain(andel(rutor[3]));
        expect(d.getElementById('nyckel-st-representation').textContent).toBe(`${d.querySelectorAll('#struktur-representation tbody tr').length} BAS-intervall`);
        expect(['Jämnt', 'Glastak', 'Klibbigt golv']).toContain(d.getElementById('nyckel-st-fordelning').textContent);
        expect(rutor[4]).toContain(d.getElementById('nyckel-st-fordelning').textContent);
        expect(d.getElementById('nyckel-st-eu').textContent).toMatch(/^Kvinnors medianlön \d+,\d\s% av mäns$/);
        expect(d.getElementById('view-struktur').textContent).not.toMatch(/Sticky floor/);
    });
    it('Struktur utan könsuppdelning visar inga könstal i toppen', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        w.eval('sattKTroskel(150, { fraga: false })');           // männen är färre än 150
        w.__state.kLage = 'export';                                // så som fliken lämnar verktyget (ADR-51)
        d.querySelector('.nav-item[data-tab="struktur"]').click();
        const rutor = [...d.querySelectorAll('#st-slutsatser .slutsats')];
        expect(rutor).toHaveLength(1);
        expect(rutor[0].textContent).toContain('Visas inte');
        expect(d.getElementById('st-slutsatser').textContent).not.toMatch(/\d+ %/);
        expect(d.getElementById('nyckel-st-eu').textContent).toBe('');
        expect(d.getElementById('nyckel-st-fordelning').textContent).toBe('');
    });
    it('Likvärdigt arbete — paren öppna, exporten hos paren, och inställningarna står kvar utfällda när ett värde ändras', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="likvardighet"]').click();
        const avsnitt = () => [...d.querySelectorAll('details.avsnitt[id^="avsnitt-lv-"]')];
        expect(avsnitt().map(a => a.id.replace('avsnitt-lv-', ''))).toEqual(['par', 'underlag', 'installningar', 'analys', 'aidbas', 'hierarki', 'poang', 'metod']);
        expect(avsnitt().filter(a => a.open).map(a => a.id)).toEqual(['avsnitt-lv-par']);
        const fore = (a, b) => !!(d.getElementById(a).compareDocumentPosition(d.getElementById(b)) & 4);
        expect(fore('lv-slutsatser', 'chart-likvardighet-krav') && fore('chart-likvardighet-krav', 'avsnitt-lv-par')).toBe(true);
        const par = d.querySelectorAll('#likvardighet-table tbody tr').length;
        expect(par).toBeGreaterThan(0);
        expect(d.getElementById('nyckel-lv-par').textContent).toBe(`${par} par`);
        const rutor = [...d.querySelectorAll('#lv-slutsatser .slutsats')].map(r => r.textContent);
        expect(rutor).toHaveLength(4);
        expect(rutor[2]).toContain(String(par));
        expect(d.getElementById('btn-export-likvardighet-csv').closest('details').id).toBe('avsnitt-lv-par');
        expect(d.getElementById('lv-min-gap').closest('details').id).toBe('avsnitt-lv-installningar');
        expect(d.getElementById('arbvard-band').closest('details').id).toBe('avsnitt-lv-poang');
        expect(d.getElementById('nyckel-lv-installningar').textContent).toBe('Standardvärden');
        // Användaren fäller ut inställningarna och ändrar ett värde: fliken ritas om, avsnittet står kvar öppet.
        d.getElementById('avsnitt-lv-installningar').open = true;
        d.getElementById('avsnitt-lv-par').open = false;
        const falt = d.getElementById('lv-min-gap');
        falt.value = '1';
        falt.dispatchEvent(new w.Event('change', { bubbles: true }));
        expect(avsnitt().filter(a => a.open).map(a => a.id)).toEqual(['avsnitt-lv-installningar']);
        expect(d.getElementById('nyckel-lv-installningar').textContent).toBe('Anpassade värden');
        expect(d.getElementById('lv-min-gap').value).toBe('1');
    });
    it('Löneöversyn — budget och utfall före avsnitten, och antalet riktade potter i rubriken', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="loneoversyn"]').click();
        const fore = (a, b) => !!(d.getElementById(a).compareDocumentPosition(d.getElementById(b)) & 4);
        expect(fore('forecast-budget-value', 'forecast-meter') && fore('forecast-meter', 'forecast-outcome') && fore('forecast-outcome', 'avsnitt-lo-riktade')).toBe(true);
        expect([...d.querySelectorAll('details.avsnitt[id^="avsnitt-lo-"]')].map(a => a.id.replace('avsnitt-lo-', '')))
            .toEqual(['riktade', 'planering', 'individ', 'scenarier', 'metod']);
        for (const [id, avsnitt] of [['forecast-optimize', 'riktade'], ['forecast-round', 'planering'], ['forecast-rem-btn', 'individ'], ['forecast-save-a', 'scenarier']]) {
            expect(d.getElementById(id).closest('details').id, id).toBe(`avsnitt-lo-${avsnitt}`);
        }
        expect(d.getElementById('forecast-budget-value').closest('details')).toBeNull();
        expect(d.getElementById('nyckel-lo-riktade').textContent).toBe('Inga riktade potter');
        expect(d.getElementById('nyckel-lo-planering').textContent).toBe('Standardvärden');
        d.getElementById('forecast-add-target').click();
        expect(d.getElementById('nyckel-lo-riktade').textContent).toBe('1 riktad pott');
        expect(d.querySelector('#view-loneoversyn .first-run-hint').textContent).not.toMatch(/steg \d/);
    });
    it('Lönepolitik — slutsatserna räknar de yrkesgrupper tabellen visar med position', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="benchmark"]').click();
        const avsnitt = () => [...d.querySelectorAll('details.avsnitt[id^="avsnitt-lp-"]')];
        expect(avsnitt().map(a => a.id.replace('avsnitt-lp-', ''))).toEqual(['tabell', 'kon', 'efterlevnad', 'tackning']);
        expect(avsnitt().filter(a => a.open).map(a => a.id)).toEqual(['avsnitt-lp-tabell']);
        const fore = (a, b) => !!(d.getElementById(a).compareDocumentPosition(d.getElementById(b)) & 4);
        // Bandkartan står i Löneläget överst (avsnittet Överblick), före avsnittet mot ställningstagandet och dess slutsatser.
        expect(d.getElementById('avsnitt-jmf-bandkartor').contains(d.getElementById('chart-lp-bandmap'))).toBe(true);
        expect(fore('chart-lp-bandmap', 'lp-slutsatser') && fore('lp-slutsatser', 'avsnitt-lp-tabell')).toBe(true);
        // Positionen står i tabellens femte kolumn; bara rader med en position räknas.
        const pos = [...d.querySelectorAll('#lonepolitik-table tbody tr')].map(tr => tr.children[4]).filter(td => td && /^-?\d/.test(td.dataset.sortValue || '')).map(td => +td.dataset.sortValue);
        expect(pos.length).toBeGreaterThan(0);
        // Gruppens namn står som i exporten: AID-koden en gång och sedan etikettnamnet («206017 Sjuksköterska»).
        const namn = [...d.querySelectorAll('#lonepolitik-table tbody tr:not(.group-header) > td:first-child')].map(td => td.textContent.trim());
        expect(namn.length).toBeGreaterThan(0);
        expect(namn.filter(t => /^(\d+) \1\b/.test(t))).toEqual([]);
        expect(namn.filter(t => /^\d+ \S/.test(t)).length).toBeGreaterThan(0);
        const tal = [...d.querySelectorAll('#lp-slutsatser .slutsats-varde')].map(e => e.textContent);
        expect(tal).toHaveLength(4);
        expect(tal.slice(1).map(Number)).toEqual([pos.filter(p => p < 0).length, pos.filter(p => p >= 0 && p <= 100).length, pos.filter(p => p > 100).length]);
        expect(d.getElementById('nyckel-lp-tabell').textContent).toBe(`${pos.length} AID-etiketter i BAS-intervall`);
        expect(d.getElementById('nyckel-lp-tackning').textContent).toBe(tal[0]);
        expect(d.querySelectorAll('#lp-slutsatser .ar-kritisk')).toHaveLength(0);      // utanför spannet är ett fynd, inte ett fel
        expect(d.getElementById('lonepolitik-rubrik').closest('.flik-intro')).not.toBeNull();
        // Ny ritning bevarar vilka avsnitt som är utfällda.
        d.getElementById('avsnitt-lp-efterlevnad').open = true;
        w.__renderTabContent('lonepolitik');
        expect(avsnitt().filter(a => a.open).map(a => a.id)).toEqual(['avsnitt-lp-tabell', 'avsnitt-lp-efterlevnad']);
    });
    it('menyn på smala skärmar — knappen Meny öppnar och stänger, och varje menyval har sin etikett i ett eget element', () => {
        const w = createAppWindow();
        const d = w.document;
        const knapp = d.getElementById('btn-meny'), skugga = d.getElementById('meny-skugga');
        expect(knapp.getAttribute('aria-controls')).toBe('sidomeny');
        expect(d.getElementById('sidomeny').classList.contains('sidebar')).toBe(true);
        expect(knapp.getAttribute('aria-expanded')).toBe('false');
        expect(skugga.hidden).toBe(true);
        // Etiketten ligger i ett eget element, så att ikonraden kan visa den vid pekaren; knappens namn är oförändrat.
        const val = [...d.querySelectorAll('.nav-item')];
        expect(val.length).toBeGreaterThanOrEqual(13);
        for (const k of val) {
            expect(k.querySelectorAll('.nav-etikett'), k.id).toHaveLength(1);
            expect(k.querySelector('.nav-etikett').textContent.trim()).toBe(k.textContent.trim());
        }
        knapp.click();
        expect(d.body.classList.contains('meny-oppen')).toBe(true);
        expect(knapp.getAttribute('aria-expanded')).toBe('true');
        expect(skugga.hidden).toBe(false);
        expect(d.activeElement.classList.contains('nav-item')).toBe(true);
        d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(d.body.classList.contains('meny-oppen')).toBe(false);
        expect(knapp.getAttribute('aria-expanded')).toBe('false');
        expect(d.activeElement).toBe(knapp);
        // Ett klick utanför (på skuggan) och ett val i menyn stänger också.
        knapp.click(); skugga.click();
        expect(d.body.classList.contains('meny-oppen')).toBe(false);
        knapp.click();
        d.querySelector('.nav-item[data-tab="info"]').click();
        expect(d.body.classList.contains('meny-oppen')).toBe(false);
        expect(skugga.hidden).toBe(true);
        expect(d.getElementById('view-info').style.display).toBe('block');
        // Escape utan öppen meny rör inte fokus.
        d.querySelector('.nav-item[data-tab="info"]').focus();
        d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(d.activeElement).toBe(d.querySelector('.nav-item[data-tab="info"]'));
        // Ett byte över brytpunkten 640 punkter stänger menyn utan glidning; ett eget öppnande efteråt står kvar.
        const byten = w.__mediaLyssnare.filter(l => l.media === '(max-width: 640px)' && l.typ === 'change');
        expect(byten).toHaveLength(1);
        knapp.click();
        expect(d.body.classList.contains('meny-oppen')).toBe(true);
        byten[0].fn({ matches: true });
        expect(d.body.classList.contains('meny-oppen')).toBe(false);
        expect(knapp.getAttribute('aria-expanded')).toBe('false');
        expect(skugga.hidden).toBe(true);
        expect(d.body.classList.contains('meny-utan-glidning')).toBe(true);
        knapp.click();
        expect(d.body.classList.contains('meny-oppen')).toBe(true);
    });
    it('Översikt visar Kom igång före inläsning och läget efter; filerna står i Filer och kvalitet', () => {
        const w = createAppWindow();
        const d = w.document, vy = d.getElementById('view-dashboard');
        // Före inläsning: ingen filrad; startytan Kom igång har ytan för lönefilen, demona och raden om organisationspaketet
        // som pekar på Filer och kvalitet; stegen står hopfällda under Fördjupning, som efter inläsning.
        expect(vy.classList.contains('har-data')).toBe(false);
        expect(d.getElementById('ov-filrad').textContent).toBe('');
        expect(d.getElementById('avsnitt-ov-process').open).toBe(false);
        expect(d.querySelector('#first-run-hint #drop-area-start')).not.toBeNull();
        expect(d.querySelector('#first-run-hint .ov-start-paket [data-go-to-tab="filer"]')).not.toBeNull();
        expect(d.querySelector('#first-run-hint .ov-start-paket').textContent).toMatch(/organisationspaket/);
        expect(d.getElementById('ov-fordjupning').compareDocumentPosition(d.getElementById('avsnitt-ov-process')) & 4).toBeTruthy();
        // Stegräkningen säger vad den räknar: listan har nio steg, verktyget kan se fem.
        const intro = d.querySelector('#process-tracker .ptrack-intro').textContent.replace(/\s+/g, ' ');
        expect(d.querySelectorAll('#process-tracker .ptrack-row')).toHaveLength(9);
        expect(intro).toMatch(/Verktyget kan se 5 av de 9 stegen/);
        expect(intro).toMatch(/Klara: 0 av de 5 steg som verktyget kan se\./);
        expect(intro).not.toMatch(/\d\/\d/);
        const filer = d.getElementById('view-filer');
        expect(filer.contains(d.getElementById('upload-sektion')) && filer.contains(d.getElementById('file-input-data')) && filer.contains(d.getElementById('organisationspaket'))).toBe(true);
        expect(vy.contains(d.getElementById('upload-sektion'))).toBe(false);
        w.__loadDemoData();
        expect(vy.classList.contains('har-data')).toBe(true);
        const rad = d.getElementById('ov-filrad');
        expect(rad.textContent).toMatch(/Lönefil: 260 personer.*Referens: .+Jämförelsestatistik: ingen inläst.*Minsta gruppstorlek 10.*Filer och kvalitet/);
        // Ordningen: filraden, nyckeltalen, Att göra och sedan avsnitten. Kartan och kvartilerna står i Struktur.
        const fore = (a, b) => !!(d.getElementById(a).compareDocumentPosition(d.getElementById(b)) & 4);
        expect(fore('ov-filrad', 'dashboard-summary') && fore('dashboard-summary', 'att-gora') && fore('att-gora', 'avsnitt-ov-process')
            && fore('avsnitt-ov-process', 'avsnitt-ov-gap')).toBe(true);
        expect(d.getElementById('chart-ov-tradkarta')).toBeNull();
        expect(d.getElementById('chart-ov-kvartiler')).toBeNull();
        expect(d.getElementById('view-dashboard').textContent).not.toContain('Organisationen som karta');
        // Avsnitten är hopfällda efter inläsning och bär sitt nyckeltal; kvalitetens nyckeltal står i Filer och kvalitet.
        expect([...d.querySelectorAll('#view-dashboard details.avsnitt')].filter(a => a.open)).toHaveLength(0);
        expect(d.getElementById('nyckel-ov-process').textContent).toMatch(/^Klara: \d av 5 steg som verktyget kan se$/);
        expect(['OK', 'Varning', 'Kritisk']).toContain(d.getElementById('nyckel-ov-kvalitet').textContent);
        expect(d.getElementById('nyckel-ov-kvalitet').textContent).toBe(d.querySelector('#underlagets-kvalitet-status .uk-marke').textContent);
        expect(d.getElementById('stat-age').textContent).toMatch(/^\d+,\d$/);
        // Länken i filraden går till Filer och kvalitet.
        rad.querySelector('[data-go-to-tab="filer"]').click();
        expect(d.querySelector('.nav-item.active').getAttribute('data-tab')).toBe('filer');
        d.querySelector('.nav-item[data-tab="dashboard"]').click();
        // Värdet för minsta gruppstorlek är en länk till inställningarna, med fokus i fältet.
        d.querySelector('#ov-filrad [data-oppna-installningar]').click();
        expect(d.getElementById('installningar-modal').style.display).toBe('flex');
        expect(d.activeElement.id).toBe('k-troskel');
        w.eval('stangInstallningar()');
        // Rensning: sidan visar åter startytan, med stegen hopfällda under Fördjupning.
        w.eval('_rensaAllData()');
        expect(vy.classList.contains('har-data')).toBe(false);
        expect(d.getElementById('ov-filrad').textContent).toBe('');
        expect(d.getElementById('first-run-hint').style.display).toBe('');
        expect(d.getElementById('avsnitt-ov-process').open).toBe(false);
    });
    it('Att göra — hela listan är ett avsnitt som står kvar utfällt när en punkt bockas av', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        const avsnitt = () => d.getElementById('avsnitt-ov-punkter');
        expect(avsnitt().closest('#att-gora')).not.toBeNull();
        expect(avsnitt().open).toBe(false);
        const antal = d.querySelectorAll('#avsnitt-ov-punkter .act-cb').length;
        expect(antal).toBeGreaterThan(0);
        expect(d.getElementById('nyckel-ov-punkter').textContent).toBe(`0 av ${antal} hanterade`);
        expect(d.querySelector('#att-gora-borja .att-gora-borja-lista')).not.toBeNull();        // "Börja här" står utanför avsnittet
        expect(d.getElementById('att-gora-borja').closest('details')).toBeNull();
        avsnitt().open = true;
        const cb = d.querySelector('#avsnitt-ov-punkter .act-cb');
        cb.checked = true;
        cb.dispatchEvent(new w.Event('change', { bubbles: true }));
        expect(avsnitt().open).toBe(true);
        expect(d.getElementById('nyckel-ov-punkter').textContent).toBe(`1 av ${antal} hanterade`);
    });
    it('en höjd minsta gruppstorlek syns i Översikts filrad', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        w.eval('sattKTroskel(150, { fraga: false })');
        expect(d.getElementById('ov-filrad').textContent).toContain('Minsta gruppstorlek 150');
    });
    it('Inställningar — panelen bär det som gäller alla flikar, och flikarnas egna inställningar står kvar i flikarna', () => {
        const w = createAppWindow();
        const d = w.document, panel = d.getElementById('installningar-modal');
        expect(panel.getAttribute('role')).toBe('dialog');
        expect(panel.style.display).toBe('none');
        // Fälten har flyttat hit ur organisationspaketet; paketet (en fil) står kvar bland filerna.
        for (const id of ['k-troskel', 'btn-k-aterstall', 'k-troskel-hjalp', 'k-troskel-fel', 'org-typ', 'prio-po-pct', 'prio-cost-months', 'prio-cost-reset', 'prio-cost-summary', 'prio-cfg-atgard', 'prio-w-avvikelse']) expect(d.getElementById(id).closest('#installningar-modal'), id).not.toBeNull();
        expect(d.getElementById('file-input-paket').closest('#organisationspaket')).not.toBeNull();
        expect(d.getElementById('organisationspaket').querySelector('[data-oppna-installningar]')).not.toBeNull();
        // PO-påslag, beräkningsperiod och Prioriteringens trösklar står i panelen; flikarnas egna inställningar står kvar i flikarna.
        for (const [id, avsnitt] of [
            ['arbvard-band', 'avsnitt-lv-poang'], ['pag-grans', 'avsnitt-la-personer'], ['outliers-threshold', 'avsnitt-ov-kvalitet']]) {
            expect(d.getElementById(id).closest('#installningar-modal'), id).toBeNull();
            expect(d.getElementById(id).closest('details.avsnitt').id, id).toBe(avsnitt);
        }
        // Utan data: knappen i sidhuvudet öppnar panelen, och länkarna till låsta flikar är inaktiva.
        const knapp = d.getElementById('btn-open-installningar');
        knapp.focus(); knapp.click();
        expect(panel.style.display).toBe('flex');
        const rader = () => [...d.querySelectorAll('#inst-flikar .inst-flik')];
        expect(rader()).toHaveLength(4);
        expect(rader().filter(r => r.querySelector('button').disabled).length).toBeGreaterThanOrEqual(3);
        d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(panel.style.display).toBe('none');
        expect(d.activeElement).toBe(knapp);
        w.__loadDemoData();
        knapp.click();
        expect(d.getElementById('inst-namn').textContent).toMatch(/Organisation.+Referens.+Jämförelsestatistik/);
        expect(rader().every(r => !r.querySelector('button').disabled)).toBe(true);
        expect(rader().map(r => r.querySelector('.inst-flik-lage').textContent)).toEqual(['Standardvärden', '± 5 %', '10 % under förväntad lön', '3,0 standardavvikelser']);
        expect(d.querySelectorAll('#inst-flikar .ar-andrad')).toHaveLength(0);
        // "Öppna" stänger panelen, byter flik och fäller ut avsnittet där inställningen står.
        rader()[0].querySelector('button').click();
        expect(panel.style.display).toBe('none');
        expect(d.getElementById('view-likvardighet').style.display).toBe('block');
        expect(d.getElementById('avsnitt-lv-installningar').open).toBe(true);
        // PO-påslag och beräkningsperiod står i panelen (gäller alla flikar); en ändring slår igenom direkt och syns i sammanfattningen.
        knapp.click();
        const po = d.getElementById('prio-po-pct');
        expect(po.closest('#installningar-modal')).not.toBeNull();
        po.value = '42'; po.dispatchEvent(new w.Event('input', { bubbles: true })); po.dispatchEvent(new w.Event('change', { bubbles: true }));
        expect(w.__state.costSettings.poPct).toBe(42);
        expect(d.getElementById('prio-cost-summary').textContent).toMatch(/Anpassad.*42\s%/);
        d.getElementById('prio-cost-reset').click();
        expect(w.__state.costSettings.poPct).toBe(40);
        w.eval('stangInstallningar()');
    });
    it('utan lönefil är varje rad med en inställning i en flik inaktiv, också Tröskel för extremvärden (avsnittet är dolt)', () => {
        const w = createAppWindow(), d = w.document;
        d.getElementById('btn-open-installningar').click();
        const rad = [...d.querySelectorAll('#inst-flikar .inst-flik')].find(r => /Tröskel för extremvärden/.test(r.textContent));
        const knapp = rad.querySelector('button');
        expect(d.getElementById('avsnitt-ov-kvalitet').hidden).toBe(true);
        expect(knapp.disabled).toBe(true);
        expect(knapp.title).toBe('Läs in en lönefil först');
        for (const r of d.querySelectorAll('#inst-flikar .inst-flik button')) expect(r.disabled).toBe(true);
        w.eval('stangInstallningar()');
        w.__loadDemoData();
        d.getElementById('btn-open-installningar').click();
        const igen = [...d.querySelectorAll('#inst-flikar .inst-flik')].find(r => /Tröskel för extremvärden/.test(r.textContent)).querySelector('button');
        expect(igen.disabled).toBe(false);
        igen.click();
        expect(d.getElementById('avsnitt-ov-kvalitet').open).toBe(true);
        expect(d.getElementById('avsnitt-ov-kvalitet').hidden).toBe(false);
    });
    it('minsta gruppstorlek i flikarnas urvalsrad är en länk till inställningarna, och en ändring där slår igenom', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        for (const [flik, rad] of [['matrix', 'la-urval'], ['struktur', 'st-urval'], ['likvardighet', 'lv-urval'], ['benchmark', 'lp-urval']]) {
            d.querySelector(`.nav-item[data-tab="${flik}"]`).click();
            const lank = d.querySelector(`#${rad} [data-oppna-installningar="k-troskel"]`);
            expect(lank, flik).not.toBeNull();
            expect(lank.textContent, flik).toBe('Minsta gruppstorlek 10');
        }
        d.querySelector('#lp-urval [data-oppna-installningar]').click();
        expect(d.getElementById('installningar-modal').style.display).toBe('flex');
        expect(d.activeElement.id).toBe('k-troskel');
        // Fältets egen lyssnare ritar om flikarna stegvis; här sätts värdet direkt, så att omritningen är klar på raden under.
        w.eval('sattKTroskel(25, { fraga: false })');
        expect(d.getElementById('k-troskel').value).toBe('25');
        expect(d.querySelector('#lp-urval [data-oppna-installningar]').textContent).toBe('Minsta gruppstorlek 25');
        expect(d.getElementById('installningar-modal').style.display).toBe('flex');    // panelen står kvar öppen efter ändringen
        w.eval('stangInstallningar()');
    });
    it('sök och hoppa — bara grupper som får visas går att söka fram, och en vald träff markeras i alla diagram', () => {
        const w = createAppWindow();
        const d = w.document, falt = d.getElementById('sok-grupp'), lista = d.getElementById('sok-grupp-lista');
        const skriv = t => { falt.value = t; falt.dispatchEvent(new w.Event('input', { bubbles: true })); };
        const tangent = (el, key, extra = {}) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
        // Utan data finns inga grupper att söka i; fältet syns ändå och hittar funktionerna (tests/sok-funktioner.test.js).
        expect(d.getElementById('sok-ruta').hidden).toBe(false);
        expect(w.eval('sokKandidater()')).toEqual([]);
        w.__loadDemoData();
        expect(falt.getAttribute('role')).toBe('combobox');
        // Kandidaterna är BAS-intervall och yrkesgrupper med minst tröskeln personer — samma urval som gruppdossiern.
        const kand = w.eval('sokKandidater()');
        expect(kand.every(k => k.n >= 10)).toBe(true);
        expect(kand.filter(k => k.nyckel.startsWith('grupp:')).map(k => k.nyckel.slice(6)).sort()).toEqual(w.eval('gruppdossierCandidates().map(c => c.key)').sort());
        expect(kand.filter(k => k.nyckel.startsWith('bas:')).length).toBeGreaterThanOrEqual(3);
        // Sökningen: varje ord ska finnas, accenter och versaler spelar ingen roll, ord som börjar med söktexten först.
        skriv('UND');
        expect(lista.hidden).toBe(false);
        expect(falt.getAttribute('aria-expanded')).toBe('true');
        const namn = () => [...lista.querySelectorAll('[role="option"] .sok-namn')].map(e => e.textContent);
        expect(namn()[0]).toMatch(/Undersköterska/);
        skriv('skoterska c');
        expect(namn().length).toBeGreaterThan(0);
        expect(namn().every(n => /sköterska/i.test(n))).toBe(true);
        expect([...lista.querySelectorAll('.sok-under')].every(e => / · BAS C · /.test(e.textContent))).toBe(true);
        skriv('bas b');
        expect(namn()).toContain('BAS B');
        // Pil ned flyttar valet; Retur markerar gruppen, tömmer fältet och stänger listan.
        skriv('und');
        const forsta = lista.querySelector('[role="option"]');
        expect(forsta.getAttribute('aria-selected')).toBe('true');
        expect(falt.getAttribute('aria-activedescendant')).toBe(forsta.id);
        tangent(falt, 'Enter');
        const markerat = w.eval('diagramMarkering()');
        expect(markerat).toHaveLength(1);
        expect(markerat[0]).toMatch(/^grupp:\d+\|[A-Z]$/);
        expect(falt.value).toBe('');
        expect(lista.hidden).toBe(true);
        expect(d.getElementById('markering-rad').textContent).toMatch(/Markerat i alla diagram: .*Undersköterska.*Öppna gruppdossier/);
        // Samma grupp en gång till: den står kvar markerad (ett klick i ett diagram hade tagit bort den).
        skriv('und'); tangent(falt, 'Enter');
        expect(w.eval('diagramMarkering()')).toEqual(markerat);
        // Escape i fältet stänger listan men rör inte markeringen; Escape utanför tar bort den.
        skriv('bas');
        tangent(falt, 'Escape');
        expect(lista.hidden).toBe(true);
        expect(w.eval('diagramMarkering()')).toEqual(markerat);
        tangent(d.body, 'Escape');
        expect(w.eval('diagramMarkering()')).toBeNull();
        // Kortkommandon: "/" utanför textfält och Ctrl+K sätter fokus i fältet; "/" i ett textfält gör det inte.
        d.querySelector('.nav-item').focus();
        tangent(d.querySelector('.nav-item'), '/');
        expect(d.activeElement).toBe(falt);
        d.querySelector('.nav-item[data-tab="dokumentera"]').click();
        const annat = d.getElementById('kl-org-name');
        annat.focus(); tangent(annat, '/');
        expect(d.activeElement).toBe(annat);
        tangent(annat, 'k', { ctrlKey: true });
        expect(d.activeElement).toBe(falt);
    });
    it('alla grupper går att söka fram oavsett tröskel (skärmen maskerar inget, ADR-51)', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document, falt = d.getElementById('sok-grupp'), lista = d.getElementById('sok-grupp-lista');
        const skriv = t => { falt.value = t; falt.dispatchEvent(new w.Event('input', { bubbles: true })); };
        const fore = w.eval('sokKandidater()').map(k => k.nyckel);
        w.eval('sattKTroskel(25, { fraga: false })');
        const efter = w.eval('sokKandidater()');
        expect(efter.map(k => k.nyckel)).toEqual(fore);
        expect(efter.some(k => k.n < 25)).toBe(true);                // demodatan har grupper med 20–24 personer
        skriv('finnsintealls');
        expect(lista.querySelectorAll('[role="option"]')).toHaveLength(0);
        expect(lista.textContent).toBe('Ingen grupp eller funktion matchar.');
        // Rensning stänger träfflistan; fältet står kvar och hittar funktionerna.
        w.eval('_rensaAllData()');
        expect(d.getElementById('sok-ruta').hidden).toBe(false);
        expect(lista.hidden).toBe(true);
        expect(w.eval('sokKandidater()')).toEqual([]);
    });
    it('exportgrinden — en flik som ritades före en ändrad tröskel ritas om innan något läses ur den', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        const oppna = f => d.querySelector(`.nav-item[data-tab="${f}"]`).click();
        oppna('struktur'); oppna('matrix'); oppna('prioritering');
        expect(w.eval("flikInaktuell('struktur') || flikInaktuell('matrix')")).toBe(false);
        const kvartiler = d.getElementById('chart-struktur-kvartiler');
        expect(w.eval('diagramRitat(document.getElementById("chart-struktur-kvartiler"))')).toBe(true);
        w.eval('sattKTroskel(25, { fraga: false })');
        // Den öppna fliken är omritad; de andra är inaktuella och deras diagram tömda.
        expect(w.eval("flikInaktuell('prioritering')")).toBe(false);
        expect(w.eval("flikInaktuell('struktur') && flikInaktuell('matrix')")).toBe(true);
        expect(d.querySelectorAll('#view-struktur svg:not(.ikon)').length).toBe(0);
        // Diagram: det tömda elementet sitter inte kvar i sidan och har inget att exportera.
        w.__tomt = kvartiler;
        expect(kvartiler.isConnected).toBe(false);
        expect(w.eval('_chartExportUnderlag(window.__tomt)')).toBeNull();
        expect(w.eval('exportSakra(window.__tomt)')).toBe(false);
        // ZIP-exporten tar "allt som är ritat": den ritar först om varje flik som ritats förut men inte är aktuell.
        const zip = w.eval('zipDiagram().map(el => el.id)');   // i exportläget: varje flik som ritats ritas om före uppräkningen
        expect(zip).toContain('chart-struktur-kvartiler');
        expect(w.eval('diagramRitat(document.getElementById("chart-struktur-kvartiler"))')).toBe(true);
        w.eval('sattKTroskel(26, { fraga: false })');                    // en ändring till: Lika arbete är inaktuell igen
        expect(w.eval("flikInaktuell('matrix')")).toBe(true);
        // Tabell: en läsning genom grinden ritar om Lika arbete först, och raderna bär den nya tröskeln.
        const klon = w.eval("_cloneAndCleanTableForExport('paygap-table')");   // ritar om Lika arbete i exportläget; efteråt är fliken inaktuell igen (skärmläget)
        expect(klon).not.toBeNull();
        expect(klon.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    });
    it('grinden stänger vid fel — går fliken inte att rita om exporteras ingenting ur den', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="struktur"]').click();
        d.querySelector('.nav-item[data-tab="dashboard"]').click();
        w.eval('sattKTroskel(25, { fraga: false })');
        w.eval("const __r = _renderTabContent; _renderTabContent = function (f) { if (f === 'struktur') throw new Error('prov'); return __r(f); };");
        expect(w.eval("_cloneAndCleanTableForExport('paygap-table')")).toBeNull();
        expect(w.eval('exportSakra(document.getElementById("chart-skevhet-overview"))')).toBe(false);
        expect(w.eval("flikInaktuell('struktur')")).toBe(true);
    });
    it('"Rensa all data" lämnar exportmenyerna och BAS-väljaren i Ålder & karriär orörda', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="struktur"]').click();
        d.querySelector('.nav-item[data-tab="kon"]').click();
        const menyer = () => [...d.querySelectorAll('.chart-export-meny')];
        expect(menyer().length).toBeGreaterThan(2);
        const val = () => menyer().map(m => m.querySelectorAll('button[data-chart-export]').length);
        expect(val().every(n => n >= 3)).toBe(true);
        w.eval('_rensaAllData()');
        // Menyer som låg i en behållare som fylls av koden försvinner med den; de som står kvar har sina val kvar.
        expect(menyer().length).toBeGreaterThan(2);
        expect(val().every(n => n >= 3)).toBe(true);
        expect(d.getElementById('bas-select-kon')).not.toBeNull();          // väljaren hör till sidan, inte till det ritade
        expect(d.getElementById('ak-urval-text').textContent).toBe('');
        w.__loadDemoData();
        d.querySelector('.nav-item[data-tab="kon"]').click();
        expect(d.getElementById('bas-select-kon').options.length).toBeGreaterThan(1);
    });
    it('två lägen — väljaren står i Inställningar, läget ändrar bara vad som visas och lagras inte', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        expect(w.eval('lage()')).toBe('vagledande');
        expect(d.body.classList.contains('lage-kompakt')).toBe(false);
        for (const id of ['lage-vagledande', 'lage-kompakt']) expect(d.getElementById(id).closest('#installningar-modal'), id).not.toBeNull();
        expect(d.getElementById('lage-vagledande').getAttribute('aria-pressed')).toBe('true');
        d.querySelector('.nav-item[data-tab="matrix"]').click();
        const oppna = () => [...d.querySelectorAll('details.avsnitt')].filter(a => a.open).map(a => a.id);
        const fore = { oppna: oppna(), text: d.getElementById('view-regression').textContent, tal: d.getElementById('la-slutsatser').textContent };
        d.getElementById('lage-kompakt').click();
        expect(w.eval('lage()')).toBe('kompakt');
        expect(d.body.classList.contains('lage-kompakt')).toBe(true);
        expect(d.getElementById('lage-kompakt').getAttribute('aria-pressed')).toBe('true');
        expect(d.getElementById('lage-vagledande').getAttribute('aria-pressed')).toBe('false');
        // Läget rör inte sidans innehåll: samma text, samma tal och samma avsnitt utfällda (det som döljs döljs av stilmallen).
        expect(oppna()).toEqual(fore.oppna);
        expect(d.getElementById('view-regression').textContent).toBe(fore.text);
        expect(d.getElementById('la-slutsatser').textContent).toBe(fore.tal);
        // Inget lagras och inget följer med i konfigurationsfilen.
        expect(w.localStorage.length).toBe(0);
        expect(w.sessionStorage.length).toBe(0);
        expect(JSON.stringify(w.eval('buildConfigSnapshot()'))).not.toMatch(/kompakt|"lage"/);
        // Rensning av data rör inte läget (det är en inställning för visningen), och ett okänt värde ger vägledande.
        w.eval('_rensaAllData()');
        expect(w.eval('lage()')).toBe('kompakt');
        w.eval("sattLage('nagot-annat')");
        expect(w.eval('lage()')).toBe('vagledande');
        expect(d.body.classList.contains('lage-kompakt')).toBe(false);
    });
    it('stilmallen döljer rätt saker före inläsning och i kompakt läge', async () => {
        const { readFileSync } = await import('node:fs');
        const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        // Före inläsning är Översikts lägesdelar dolda, var och en med egen väljare. Fördjupning (stegen) syns i båda lägena.
        for (const id of ['ov-filrad', 'ov-intro']) expect(css).toContain(`#view-dashboard:not(.har-data) #${id}`);
        expect(css).not.toContain('#view-dashboard:not(.har-data) #ov-fordjupning');
        // Kompakt läge döljer förklaringar, men aldrig noter om små grupper eller förbehåll.
        const kompakt = [...css.matchAll(/([^{}]*lage-kompakt[^{}]*)\{([^}]*)\}/g)].filter(m => /display:\s*none/.test(m[2])).map(m => m[1]).join(' ');
        expect(kompakt).toMatch(/\.avsnitt-under/);
        expect(kompakt).not.toMatch(/k-mask-note|reg-caveat|export-besked|diagramkort-forklaring|slutsats/);
    });
    it('utan data är samverkansknapparna i Handlingsplan inaktiva, och Exportera heter "Innan du exporterar"', () => {
        const w = createAppWindow();
        w.document.querySelector('.nav-item[data-tab="handlingsplan"]').click();
        const knappar = [...w.document.querySelectorAll('[data-dok-klick]')];
        expect(knappar.length).toBe(2);
        expect(knappar.every(b => b.disabled)).toBe(true);
        expect(w.document.getElementById('view-kvalitet').textContent).toMatch(/innan du exporterar/i);
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="handlingsplan"]').click();
        expect([...w.document.querySelectorAll('[data-dok-klick]')].every(b => !b.disabled)).toBe(true);
    });
    it('Prioriteringens tomläge talar inte om att ladda upp ett ställningstagande', () => {
        const w = createAppWindow();
        expect(w.document.getElementById('prio-empty').textContent).not.toMatch(/ställningstagande laddas upp/);
    });
});

describe('startytan på Översikt (före inläsning)', () => {
    // Ytan för lönefilen har ingen egen filväljare: den öppnar lönefilskortets, och en släppt fil går samma väg
    // (change-händelsen på #file-input-data och loadStructureFile).
    const slapp = (w, fil) => {
        const inp = w.document.getElementById('file-input-data');
        let filer = { length: 0 };
        Object.defineProperty(inp, 'files', { configurable: true, get: () => filer, set: v => { filer = v; } });
        const ev = new w.Event('drop', { bubbles: true, cancelable: true });
        Object.defineProperty(ev, 'dataTransfer', { value: { files: { 0: fil, length: 1 } } });
        w.document.getElementById('drop-area-start').dispatchEvent(ev);
    };
    it('har ingen egen filväljare: knappen och ytan öppnar lönefilskortets', () => {
        const w = createAppWindow(), d = w.document;
        expect(d.querySelectorAll('#first-run-hint input[type="file"]')).toHaveLength(0);
        let klick = 0;
        d.getElementById('file-input-data').click = () => { klick++; };
        d.getElementById('btn-start-lonefil').click();
        expect(klick).toBe(1);
        d.getElementById('drop-area-start').click();
        expect(klick).toBe(2);
    });
    it('en släppt lönefil läses in som i Filer och kvalitet, och Översikt visar läget', async () => {
        const w = createAppWindow(), d = w.document;
        papa(w);
        slapp(w, csvFil(w, braRader(), 'start.csv'));
        await vanta(() => w.__state.data.length);
        expect(w.__state.data).toHaveLength(30);
        expect(w.__state.filnamn.data).toBe('start.csv');
        expect(d.querySelector('#upload-cell-data .upload-badge').textContent).toContain('Inläst');
        expect(d.querySelector('.nav-item.active').getAttribute('data-tab')).toBe('dashboard');
        expect(d.getElementById('view-dashboard').classList.contains('har-data')).toBe(true);
        expect(d.getElementById('first-run-hint').style.display).toBe('none');
    });
    it('en fil som inte läses in leder till lönefilskortet i Filer och kvalitet, där beskedet står', async () => {
        const w = createAppWindow(), d = w.document;
        slapp(w, new w.File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])], 'arbetsbok.xls'));
        await vanta(() => /äldre Excel-format/.test(d.getElementById('data-status').textContent));
        expect(w.__state.data).toHaveLength(0);
        expect(d.querySelector('.nav-item.active').getAttribute('data-tab')).toBe('filer');
        expect(d.getElementById('upload-cell-data').classList.contains('visas-nu')).toBe(true);
        expect(d.activeElement.id).toBe('file-input-data');
    });
});

describe('länkar till ett avsnitt i en annan flik', () => {
    it('Att göra-länkarna till Lönestruktur byter flik och fäller ut avsnittet de leder till', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        const d = w.document;
        for (const id of ['avsnitt-ls-bas', 'avsnitt-ls-kon']) d.getElementById(id).open = false;
        d.querySelector('#comp-gap .comp-lank').click();
        expect(d.querySelector('.nav-item.active').getAttribute('data-tab')).toBe('struktur');
        expect(d.getElementById('avsnitt-ls-bas').open).toBe(true);
        expect(d.getElementById('avsnitt-ls-kon').open).toBe(false);
        d.querySelector('#comp-skev .comp-lank').click();
        expect(d.getElementById('avsnitt-ls-kon').open).toBe(true);
    });
});

describe('flik utan underlag', () => {
    it('säger att inget underlag är inläst och länkar till Filer och kvalitet; raden försvinner när underlaget finns', () => {
        const w = createAppWindow();
        w.eval("renderTabContent('matrix')");
        const rad = () => w.document.querySelector('#view-lika-yrken > .inget-underlag');
        expect(rad().textContent).toContain('Inget underlag inläst');
        expect(rad().querySelector('[data-go-to-tab="filer"]')).toBeTruthy();
        expect(rad().textContent).toContain('under Filer och kvalitet');
        w.eval("renderTabContent('matrix')");
        expect(w.document.querySelectorAll('#view-lika-yrken > .inget-underlag').length).toBe(1);
        w.__loadDemoData();
        w.eval("renderTabContent('matrix')");
        expect(rad()).toBeNull();
    });
    it('flikar som inte kräver lönefilen får ingen sådan rad', () => {
        const w = createAppWindow();
        w.eval("renderTabContent('handlingsplan'); renderTabContent('info')");
        expect(w.document.querySelector('.inget-underlag')).toBeNull();
    });
});

describe('utskrift av den aktiva fliken (Ctrl+P)', () => {
    it('regeln som döljer allt utom PDF-rapporten gäller bara när PDF-knappen satt body.print-mode', () => {
        const css = las('src/style.css');
        expect(css).not.toMatch(/^\s*body \* \{ visibility: hidden; \}/m);
        expect(css).toContain('body.print-mode * { visibility: hidden; }');
    });
    it('hopfällda avsnitt i den synliga fliken fälls ut före utskriften och tillbaka efteråt', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const avsnitt = [...w.document.querySelectorAll('#view-lika-yrken details.avsnitt')];
        expect(avsnitt.length).toBeGreaterThan(0);
        avsnitt.forEach((d, i) => { d.open = i === 0; });
        w.dispatchEvent(new w.Event('beforeprint'));
        expect(avsnitt.every(d => d.open)).toBe(true);
        w.dispatchEvent(new w.Event('afterprint'));
        expect(avsnitt.map(d => d.open)).toEqual(avsnitt.map((_, i) => i === 0));
    });
    it('PDF-rapportens utskrift rör inte avsnitten', () => {
        const w = createAppWindow();
        w.__loadDemoData();
        w.document.querySelector('.nav-item[data-tab="matrix"]').click();
        const avsnitt = [...w.document.querySelectorAll('#view-lika-yrken details.avsnitt')];
        avsnitt.forEach(d => { d.open = false; });
        w.document.body.classList.add('print-mode');
        w.dispatchEvent(new w.Event('beforeprint'));
        expect(avsnitt.some(d => d.open)).toBe(false);
        w.dispatchEvent(new w.Event('afterprint'));
        expect(w.document.body.classList.contains('print-mode')).toBe(false);
    });
});

describe('sortering, Att göra, kopiering och Likvärdigt arbete — licens', () => {
    it('Om verktyget visar licenstexterna från den inbyggda mallen', () => {
        const w = createAppWindow();
        const t = w.document.createElement('template'); t.id = 'licenstexter';
        t.innerHTML = '<pre>Permission is hereby granted — testtext</pre>';
        w.document.body.appendChild(t);
        w.document.querySelector('.nav-item[data-tab="info"]').click();
        w.eval("renderInfoTab('references')");
        expect(w.document.getElementById('om-licenstexter').textContent).toContain('Permission is hereby granted');
        expect(w.document.getElementById('view-info').textContent).toContain('riskanalys.md');
    });
});

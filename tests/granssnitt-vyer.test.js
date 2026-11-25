// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Vakttester för gränssnittets beteende: det som ser lyckat ut ska vara lyckat, tal skrivs på ett sätt, och
// bildspråket är linjeikoner. Varje test faller om felet det vaktar kommer tillbaka. Delen här: tomma lägen, tabellerna,
// ikonerna, språket och rubrikerna; resten i granssnitt.test.js (riggen i helpers/granssnitt-rigg.js).
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createAppWindow, delatFonster } from './helpers/app-harness.js';
import { rot, las, papa, vanta, csvFil, okandaRader } from './helpers/granssnitt-rigg.js';

// Testerna som söker igenom alla flikar läser två delade fönster med demodatan, där flikarna har ritats en gång: att
// rita dem är det dyra, inte att läsa. Ordningen spelar ingen roll (prövat: samma dokument, bortsett från
// exportmenyernas löpnummer). Vakten i delatFonster fäller det test som ändrar tillståndet.
const ALLA_FLIKAR = ['dashboard', 'bestammelser', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'handlingsplan', 'dokumentera', 'kon', 'benchmark', 'utforska', 'info'];
const allaFlikar = delatFonster(w => { w.__lasInDemodata(); for (const f of ALLA_FLIKAR) w.__ritaFlik(f); });
// Med en pott och ett generellt påslag, så att Löneöversyn ritar prognosen. Procenttestet läser också Exportera, som det
// förut inte ritade.
const medPott = delatFonster(w => {
    w.__lasInDemodata();
    w.__state.forecast.budget = { mode: 'pct', value: 2 };
    w.__state.forecast.generell = { mode: 'pct', value: 1 };
    for (const f of ['dashboard', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'kon', 'benchmark', 'utforska', 'dokumentera']) w.__ritaFlik(f);
});

describe('tomma lägen som inte låter som fel', () => {
    it('Löneöversyn utan pott visar en rad om vad som behövs, inte en tom mätare och tabeller där före är lika med efter', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__ritaFlik('loneoversyn');
        const d = w.document, vy = d.getElementById('view-loneoversyn');
        expect(vy.classList.contains('lo-tomt')).toBe(true);
        expect(d.getElementById('forecast-outcome').textContent.trim()).toBe('Ange en pott ovan så visas utfallet här.');
        expect(d.getElementById('forecast-outcome').querySelector('table')).toBeNull();
        expect(d.getElementById('forecast-meter').closest('.card').classList.contains('lo-med-utfall')).toBe(true);
        expect(las('src/style.css')).toContain('.lo-tomt .lo-med-utfall { display: none; }');
        // Med en pott visas utfallet igen.
        w.__state.forecast.budget = { mode: 'pct', value: 2 };
        w.__state.forecast.generell = { mode: 'pct', value: 1 };
        w.__ritaFlik('loneoversyn');
        expect(vy.classList.contains('lo-tomt')).toBe(false);
        expect(d.getElementById('forecast-outcome').querySelector('table')).toBeTruthy();
    });
    it('Likvärdigt arbete utan jämförelsestatistik säger att den är valfri', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__ritaFlik('likvardighet');
        const text = w.document.getElementById('view-likvardighet').textContent;
        expect(text).not.toContain('kontrollera att Excel-filen är uppladdad');
        expect(text).toContain('Ingen jämförelsestatistik inläst (valfri)');
    });
});

describe('informationsikonen har ett utförande', () => {
    it('varje .info-tip bär linjeikonen «info» och ingen text, också de som ritas av flikarna', () => {
        const w = allaFlikar();
        const tips = [...w.document.querySelectorAll('.info-tip')];
        expect(tips.length).toBeGreaterThan(40);
        const fel = tips.filter(t => t.querySelectorAll('svg.ikon-info').length !== 1 || t.textContent.trim() !== '');
        expect(fel.map(t => (t.getAttribute('data-tooltip') || t.outerHTML).slice(0, 50))).toEqual([]);
        expect(w.document.body.innerHTML).not.toContain('ⓘ');
    });
    it('nyckeltalens etiketter har ingen ikon: förklaringen står på hela rutan', () => {
        const d = allaFlikar().document;
        expect([...d.querySelectorAll('.stat-box h3 .info-tip, .slutsats-etikett .info-tip')].length).toBe(0);
        const medTips = [...d.querySelectorAll('.stat-box[data-tooltip]')];
        expect(medTips.length).toBeGreaterThanOrEqual(11);
        expect(medTips.every(r => r.getAttribute('data-tooltip').length > 20)).toBe(true);
        // Texten med termerna är ifylld (gränserna står i undertexten, ur inställningen).
        expect(d.getElementById('prio-stat-akut').closest('.stat-box').getAttribute('data-tooltip')).toMatch(/^Antal AID-etiketter i BAS-intervall med statusen Börja här/);
    });
});

describe('ett bildspråk: linjeikoner, inga bildtecken', () => {
    // Trianglar, dingbats (bock, kryss, varningstecken, stjärna), emoji och pilar.
    const BILDTECKEN = /[\u25B2-\u25BE\u2600-\u27BF\u{1F300}-\u{1FAFF}\u2913\u29C9\u2B06\u2B07\u21BA\u21BB\u2197\u2198\u21C5\u21D2\u24D8\u2139\u2300-\u23FF\u25CB\uFE0F]/u;
    const PIL_SIST = /[\u2190-\u21FF]/;   // inga pilar alls: riktning och följd skrivs med ord
    // Text som går ut i exporterna oförändrad (Excel-celler, rapportens utkastruta, demomärkningen).
    const UNDANTAG = [['22-exporthjalpare.js', 'DEMODATA — syntetisk'], ['41-lika-arbete.js', "bara('✓')"], ['58-rapportmodell.js', 'UTKAST att färdigställa']];
    const filer = [...readdirSync(join(rot, 'src/app')).filter(f => f.endsWith('.js')).map(f => 'src/app/' + f), 'src/index.html', 'src/style.css'];
    it('källan har inga bildtecken utanför kommentarer', () => {
        const fynd = [];
        for (const fil of filer) {
            las(fil).split('\n').forEach((rad, i) => {
                const t = rad.trim();
                if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--')) return;
                const kod = rad.replace(/\s\/\/ .*$/, '').replace(/\/\*.*?\*\//g, '');
                const m = BILDTECKEN.exec(kod) || PIL_SIST.exec(kod);
                if (!m) return;
                if (UNDANTAG.some(([f, text]) => fil.endsWith(f) && rad.includes(text))) return;
                fynd.push(`${fil}:${i + 1}: ${kod.slice(Math.max(0, m.index - 30), m.index + 20).trim()}`);
            });
        }
        expect(fynd).toEqual([]);
    });
    it('det ritade gränssnittet har inga bildtecken', () => {
        const w = allaFlikar();
        const fynd = new Set();
        // Varje textnod prövas, också text som står bredvid ett element (en ikon framför en fetstilt mening).
        const gang = w.document.createTreeWalker(w.document.body, w.NodeFilter.SHOW_TEXT);
        for (let n = gang.nextNode(); n; n = gang.nextNode()) {
            if (n.parentElement.closest('script, style, template, .bara-export')) continue;
            if (BILDTECKEN.test(n.nodeValue) || /[\u2190-\u21FF]/.test(n.nodeValue)) fynd.add(n.nodeValue.trim().slice(0, 50));
        }
        // Rensningen ändrar tillståndet och görs i ett eget fönster; notisen den lämnar är densamma med eller utan ritade
        // flikar (prövat).
        const rensat = createAppWindow();
        rensat.__lasInDemodata();
        rensat.eval('_rensaVidInaktivitet()');
        expect(BILDTECKEN.test(rensat.document.body.textContent.replace(/\s+/g, ' ').slice(-4000))).toBe(false);
        expect([...fynd]).toEqual([]);
    });
    it('filkortets märke och filnamnsraden bär bocken som linjeikon', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const marke = w.document.querySelector('#upload-cell-data .upload-badge');
        expect(marke.textContent.trim()).toBe('Testdata');   // demots märke; en egen fil märks «Inläst»
        expect(marke.querySelector('svg.ikon-bock')).toBeTruthy();
        const namn = w.document.querySelector('#upload-cell-data .upload-filnamn');
        expect(namn.textContent.trim()).toBe('Demodata');
        expect(namn.querySelector('svg.ikon-bock')).toBeTruthy();
    });
});

describe('svenska ord i vyerna', () => {
    it('rubriker, etiketter, knappar, tabellhuvuden och nyckeltal säger inte «vs», «OLS», «sd» eller «Compa-ratio»', () => {
        const w = medPott();
        const synligt = [...w.document.querySelectorAll('h1, h2, h3, h4, option, summary, label, button, th, .slutsats, .stat-box, .insight-box, .dvr-row')].map(el => el.textContent.replace(/\s+/g, ' ').trim());
        const rester = synligt.filter(t => /(^|[\s(])vs\.?([\s)]|$)|\bOLS\b|[\s(]sd[\s):]|Compa-ratio|grön-cirkl|Z ≥/i.test(t));
        expect(rester.map(t => t.slice(0, 80))).toEqual([]);
    });
    it('Att göra förklarar korrigeringen i ord', () => {
        const kalla = las('src/app/18-atgardslista.js');
        expect(kalla).not.toContain('BH-FDR');
        expect(kalla).toContain('korrigering för många samtidiga tester');
    });
});

describe('rubriknivåerna hoppar inte', () => {
    it('i varje vy följer rubrikerna på varandra utan att hoppa över en nivå (h1 är sidans rubrik)', () => {
        const w = allaFlikar();
        const hopp = [];
        for (const vy of w.document.querySelectorAll('.view-panel')) {
            let forra = 1;
            for (const h of vy.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
                const n = Number(h.tagName[1]);
                if (n > forra + 1) hopp.push(`${vy.id}: h${forra} → h${n} «${h.textContent.trim().slice(0, 40)}»`);
                forra = n;
            }
        }
        expect(hopp).toEqual([]);
    });
    it('nyckeltalens etiketter är inga rubriker, och ett avsnitts rubrik står inte en gång till i avsnittet', () => {
        const d = allaFlikar().document;
        expect(d.querySelectorAll('.stat-box h1, .stat-box h2, .stat-box h3, .stat-box h4').length).toBe(0);
        expect(d.querySelectorAll('.stat-box .stat-etikett').length).toBeGreaterThanOrEqual(16);
        const dubbla = [];
        for (const a of d.querySelectorAll('details.avsnitt')) {
            const titel = a.querySelector(':scope > summary h2, :scope > summary h3')?.textContent.trim();
            for (const h of a.querySelectorAll('h2:not([hidden]), h3:not([hidden]), h4:not([hidden])')) if (!h.closest('summary') && h.textContent.trim() === titel) dubbla.push(titel);   // en dold rubrik är bara ett namn åt aria-labelledby
        }
        expect(dubbla).toEqual([]);
    });
});

describe('Om verktyget följer flikmallen', () => {
    it('inledningen är en .flik-intro som på övriga flikar, och fliklisten har bara text', () => {
        const w = createAppWindow();
        const vy = w.document.getElementById('view-info');
        const intro = vy.querySelector('.flik-intro'), kort = vy.querySelector('.card');
        expect(intro.textContent).toContain('Vad gör verktyget');
        expect(intro.compareDocumentPosition(kort) & w.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();   // inledningen står före kortet
        expect(vy.querySelector('.card-header')).toBeNull();
        const flikar = [...vy.querySelectorAll('.info-section-btn')];
        expect(flikar.length).toBe(6);
        expect(flikar.filter(b => b.querySelector('svg')).length).toBe(0);
        expect(flikar.map(b => b.textContent.trim()).every(t => t.length > 2)).toBe(true);
    });
});

describe('en låst flik svarar', () => {
    it('är aria-disabled, inte disabled, så att den går att nå och skärmläsaren hör skälet', () => {
        const w = createAppWindow();
        const flik = w.document.getElementById('tab-matrix');
        expect(flik.hasAttribute('disabled')).toBe(false);
        expect(flik.getAttribute('aria-disabled')).toBe('true');
        expect(flik.disabled).toBe(true);                      // egenskapen läser aria-disabled
        expect(flik.title).toMatch(/Läs in lönefilen/);
        expect(las('src/index.html')).not.toMatch(/<button class="nav-item"[^>]*\sdisabled[\s>]/);
    });
    it('ett klick går till Filer och kvalitet, ger filväljaren fokus och markerar lönefilskortet', () => {
        const w = createAppWindow();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="info"]').click();
        expect(d.querySelector('.nav-item.active').getAttribute('data-tab')).toBe('info');
        d.getElementById('tab-matrix').click();
        expect(d.querySelector('.nav-item.active').getAttribute('data-tab')).toBe('filer');
        expect(d.getElementById('view-regression').style.display).toBe('none');
        expect(d.getElementById('view-filer').style.display).toBe('block');
        expect(d.getElementById('upload-cell-data').classList.contains('visas-nu')).toBe(true);
        expect(d.activeElement.id).toBe('file-input-data');
    });
    it('upplåsning och låsning går genom egenskapen disabled', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const flik = w.document.getElementById('tab-matrix');
        expect(flik.disabled).toBe(false);
        expect(flik.hasAttribute('aria-disabled')).toBe(false);
        flik.click();
        expect(w.document.querySelector('.nav-item.active').getAttribute('data-tab')).toBe('matrix');
        w.confirm = () => true;
        w.eval('rensaAllData()');
        expect(flik.getAttribute('aria-disabled')).toBe('true');
    });
});

describe('typografisk skala', () => {
    const css = las('src/style.css');
    const varden = [...css.matchAll(/font-size:\s*([^;}\s!]+)/g)].map(m => m[1]);
    it('stilmallen har sex steg som variabler', () => {
        const rot = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
        for (const [namn, v] of [['--fs-xs', '0.78rem'], ['--fs-sm', '0.86rem'], ['--fs-md', '0.95rem'], ['--fs-lg', '1.1rem'], ['--fs-xl', '1.4rem'], ['--fs-nyckeltal', '1.6rem']]) expect(rot).toContain(`${namn}: ${v};`);
    });
    it('de utskrivna storlekarna blir inte fler: nya regler tar ett steg ur skalan', () => {
        const utskrivna = new Set(varden.filter(v => !v.startsWith('var(')));
        // Utanför skalan står bara det som ligger långt från ett steg: de stora talen, utskriftens punktstorlekar och
        // storlekar i em.
        expect(utskrivna.size).toBeLessThanOrEqual(21);   // 21: de minsta etiketterna (0.65, 0.66, 0.68 och 0.72rem) och koden i granskningspanelen (0.9em) tar skalans minsta steg
        expect(varden.filter(v => v.startsWith('var(--fs-')).length).toBeGreaterThanOrEqual(230);
        // Inget utskrivet värde ligger inom 0,05 rem från ett steg: det ska då vara steget.
        const steg = [0.78, 0.86, 0.95, 1.1, 1.4, 1.6];
        const nara = [...utskrivna].filter(v => /rem$/.test(v) && steg.some(s => Math.abs(parseFloat(v) - s) <= 0.0501));
        expect(nara).toEqual([]);
        // Sidans egna style-attribut följer samma regel.
        const iSidan = new Set([...las('src/index.html').matchAll(/font-size:\s*([^;"\s]+)/g)].map(m => m[1]).filter(v => !v.startsWith('var(')));
        expect(iSidan.size).toBeLessThanOrEqual(4);
        expect([...iSidan].filter(v => /rem$/.test(v) && steg.some(s => Math.abs(parseFloat(v) - s) <= 0.0501))).toEqual([]);
    });
    it('ingen utskriven storlek är mindre än skalans minsta steg', () => {
        // Text under 0.78rem (12,5 punkter) blir svårläst, särskilt versala etiketter. Storlekar i em räknas mot sin
        // förälder och kan inte prövas här; tabellrubrikerna, KI-suffixet och koden tar därför steget i rem.
        const iSidan = [...las('src/index.html').matchAll(/font-size:\s*([^;"\s]+)/g)].map(m => m[1]);
        expect([...varden, ...iSidan].filter(v => /rem$/.test(v) && parseFloat(v) < 0.78)).toEqual([]);
        const regel = sel => { const i = css.indexOf(`\n${sel} {`); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
        for (const sel of ['.data-table th', '.ci-bracket']) expect(regel(sel)).toContain('font-size: var(--fs-xs);');
        // Undantaget: PDF-rapporten har en egen skala i punkter (cellerna 9pt), och dess tabellrubriker står strax under
        // cellerna. Med skärmens steg blev rubrikerna större än cellerna och de breda tabellerna bredare än A4-sidan.
        const rapportRubrik = css.indexOf('#print-report table:not(.meta):not(.kpi) th {');
        expect(css.slice(rapportRubrik, css.indexOf('}', rapportRubrik))).toContain('font-size: 8.5pt;');
    });
});

describe('övergångarna', () => {
    it('ingen övergång gäller all', () => {
        // En övergång på all tonar också det som inte ska tona, som fokusringen och layouten; varje regel anger de
        // egenskaper som dess tillstånd ändrar.
        const css = las('src/style.css');
        expect(css.match(/transition(-property)?:\s*all\b/g)).toBeNull();
        expect(css.match(/--transition:\s*all\b/g)).toBeNull();
    });
});

describe('kantränderna', () => {
    // En rand till vänster säger ett läge: den står i statusfärg och i en bredd. Undantagen är fyra lägesmarkörer för
    // navigeringen, som inte är kortränder och står kvar i sin form. De två sista är inset-skuggor; de står här så att
    // de inte görs om till ränder.
    const LAGESMARKORER = [
        '.sidindex-lista',      // sidindexet: avsnittet du står i
        '.jmf-block',           // jämförelsetabellens avdelare mellan blocken
        '.nav-item.active',     // den aktiva fliken i menyn
        'tr.rad-markerad',      // den markerade tabellraden
    ];
    it('kantränder står bara i statusfärg och i en bredd', () => {
        const css = las('src/style.css').replace(/\/\*[\s\S]*?\*\//g, '');
        const fel = [];
        for (const [, sel, kropp] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
            const s = sel.trim();
            if (s === ':root' || LAGESMARKORER.some(m => s.includes(m))) continue;
            for (const [dekl, bredd, farg] of kropp.matchAll(/border-left:\s*(\d+)px\s+[a-z]+(?:\s+var\((--[\w-]+)\))?/g)) {
                if (Number(bredd) <= 1) continue;   // en avdelare på 1 px (fältets enhet, väljarens kant) är ingen rand
                if (Number(bredd) !== 3 || !(farg || '').startsWith('--status-')) fel.push(`${s} { ${dekl} }`);
            }
            for (const [dekl, farg] of kropp.matchAll(/border-left-color:\s*var\((--[\w-]+)\)/g))
                if (!farg.startsWith('--status-')) fel.push(`${s} { ${dekl} }`);
            for (const [dekl] of kropp.matchAll(/border-left-(?:width|style):[^;}]+/g)) fel.push(`${s} { ${dekl} }`);
            // Ingen rand överst på ett kort heller (uppladdningsrutorna och organisationspaketet hade en).
            for (const [dekl, bredd] of kropp.matchAll(/border-top:\s*(\d+)px[^;}]*/g)) if (Number(bredd) > 1) fel.push(`${s} { ${dekl} }`);
        }
        expect(fel).toEqual([]);
    });
    it('mallarna sätter randen med hjälpklasserna på 3 px', () => {
        const filer = readdirSync(join(rot, 'src', 'app')).filter(f => /^\d\d-.*\.js$/.test(f));
        const fel = [];
        for (const f of [...filer.map(f => `src/app/${f}`), 'src/index.html']) {
            const text = las(f);
            for (const m of text.matchAll(/\b(ram-v-4-[\w-]+|bl4-[\w$-]+|ram-v-farg-[\w-]+)/g)) fel.push(`${f}: ${m[1]}`);
            for (const m of text.matchAll(/border-left:\s*(\d+)px/g)) if (m[1] !== '3') fel.push(`${f}: ${m[0]}`);
        }
        expect(fel).toEqual([]);
    });
    it('där bara färgen visade läget står också en ikon och ett ord', () => {
        const d = allaFlikar().document;
        const ORD = /^(OK|Varning|Kritisk|Att känna till)$/;
        const marken = [
            ...d.querySelectorAll('#fardigcheck-body .fc-item'),
            ...[...d.querySelectorAll('.ruta-ok, .ruta-varning')],
            d.querySelector('#view-benchmark .lp-tackning'),
        ];
        expect(marken.length).toBeGreaterThan(3);
        const fel = marken.filter(el => {
            const m = el && el.querySelector('.uk-marke');
            return !m || !ORD.test(m.textContent.trim()) || !m.querySelector('svg.ikon[aria-hidden="true"]');
        });
        expect(fel.map(el => (el ? el.className : 'saknas'))).toEqual([]);
    });
});

describe('slutgranskningens fynd', () => {
    const lasIn = async (w, rader) => { papa(w); w.lasInStrukturfil(csvFil(w, rader)); await vanta(() => w.document.getElementById('data-status').textContent && !/läser|Läser/.test(w.document.getElementById('data-status').textContent)); };
    it('en fil som saknar en obligatorisk kolumn men har läsbara rader läses in, och kolumnmappningen säger vad som saknas', async () => {
        const w = createAppWindow();
        // Ålder är valfri (ADR-64); filen saknar i stället AID.
        const rader = ['BAS;Månadslön;Kön;Ålder'];
        for (let i = 0; i < 30; i++) rader.push(`C;${30000 + i * 10};${i % 2 ? 'Man' : 'Kvinna'};${30 + i}`);
        await lasIn(w, rader);
        await vanta(() => w.__state.data.length);
        expect(w.__state.data.length).toBe(30);
        expect(w.document.getElementById('tab-matrix').disabled).toBe(false);
        expect(w.document.getElementById('column-map-panel').textContent).toContain('Kolumnmappning behövs');
    });
    it('en mappning som pekar på en rubrik som inte finns i den nya filen räknas inte som funnen', async () => {
        const w = createAppWindow();
        w.__state.columnMap = { bas: 'Finns inte', yrke: 'Finns inte', lon: 'Finns inte', alder: 'Finns inte', kon: 'Finns inte' };
        await lasIn(w, okandaRader());
        const panel = w.document.getElementById('column-map-panel');
        expect(panel.textContent).toContain('Kolumnmappning behövs');
        expect(panel.querySelectorAll('select.colmap-saknas').length).toBeGreaterThanOrEqual(2);   // två rubriker känns igen av sig själva; ålder är valfri (ADR-64)
        expect(w.document.querySelector('#upload-cell-data .upload-badge').textContent).toContain('Kolumnmappning');
    });
    it('en CSV med bara rubrikrad sägs sakna rader, inte kolumner', async () => {
        const w = createAppWindow();
        await lasIn(w, ['BAS;Månadslön;Ålder;Kön;AID']);
        expect(w.document.getElementById('data-status').textContent).toContain('filen har inga rader');
        expect(w.document.querySelector('#upload-cell-data .upload-badge').textContent).toContain('Inga rader');
    });
    it('regressionskortets tolkning har samma precision som huvudtalet', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__ritaFlik('struktur');
        expect(w.document.getElementById('regression-card').querySelector('.reg-verdict')?.closest('.card').textContent.match(/\d,\d\d\s% (mindre|mer)|skillnad på \d+,\d\d\s%/)).toBeNull();
    });
    it('piltangent på en låst flik går till närmaste upplåsta flik i den riktningen, inte runt hela menyn', () => {
        const w = createAppWindow();
        const d = w.document, last = d.getElementById('tab-matrix');
        const flikar = [...d.querySelectorAll('.nav-item')].filter(t => !t.hidden);
        const upplasta = flikar.filter(t => !t.disabled);
        last.focus();
        last.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        const fore = flikar.slice(0, flikar.indexOf(last)).filter(t => !t.disabled).pop();
        expect(d.querySelector('.nav-item.active')).toBe(fore || upplasta[upplasta.length - 1]);
    });
    it('Löneöversyns individanalys säger jämförelsevärde, inte benchmark, och utskriften visar ansvarsraderna och raden Utan ledningsansvar', () => {
        expect(las('src/app/36-loneoversyn.js').replace(/^\s*\/\/.*$/gm, '')).not.toMatch(/benchmark/i);
        expect(las('src/style.css')).toContain('.la-underrad[hidden] { display: table-row !important; }');
    });
});

describe('procenttal i flikarna har en decimal', () => {
    it('ingen flik ritar ett procenttal med två decimaler (PO-påslaget och självdiagnostiken undantagna)', () => {
        const w = medPott();
        const fynd = new Set();
        for (const el of w.document.querySelectorAll('[id^="view-"] *')) {
            if (el.children.length || el.closest('script, style, svg, code, pre, .info-tip, .bara-export, [data-export-text], #diagnostic-results')) continue;
            if (/PO\b/.test(el.textContent)) continue;
            if (/[+\u2212-]?\d+,\d\d\s%/.test(el.textContent)) fynd.add(el.textContent.trim().slice(0, 50));
        }
        expect([...fynd]).toEqual([]);
    });
});

describe('småsaker i texter och etiketter (granskning 2026-10-30, steg H)', () => {
    it('Lika arbetes kolumn Dominans skriver ut orden, också i cellens text för exporten', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__ritaFlik('matrix');
        const d = w.document;
        const rubriker = [...d.querySelectorAll('#matrix-table thead th')];
        const kol = rubriker.findIndex(th => th.textContent.trim() === 'Dominans');
        expect(kol).toBeGreaterThan(-1);
        const varden = [...d.querySelectorAll('#matrix-table tbody tr')].filter(tr => tr._euRow).map(tr => tr.cells[kol].textContent.trim());
        expect(varden.length).toBeGreaterThan(3);
        for (const v of varden) expect(v).toMatch(/^(Kvinnodominerad|Mansdominerad|Könsblandad)$/);
        expect(d.getElementById('view-regression').closest('body').innerHTML).not.toMatch(/Kvinno-dom|Mans-dom/);
    });
    it('Likvärdigt arbetes kolumn heter Summa för gruppen, med verktygstips; Excel-bladen har samma rubrik', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__ritaFlik('likvardighet');
        const th = w.document.querySelector('#likvardighet-table thead th[data-kol="paverkan"]');
        expect(th.textContent.trim()).toBe('Summa för gruppen (kr/mån)');
        expect(th.title).toBe('Skillnaden i kronor gånger antalet personer med den kvinnodominerade AID-etiketten, per månad');
        expect(th.hasAttribute('data-export-label')).toBe(false);
        for (const fil of ['src/app/34-likvardigt-arbete.js', 'src/app/24-excelexport.js', 'src/app/27-berakningsbevis.js']) {
            expect(las(fil), fil).not.toMatch(/Påverkan/);
            expect(las(fil), fil).toContain('Summa för gruppen (kr/mån)');
        }
    });
    it('varje Nästa steg-knapp heter det menyn heter', () => {
        const w = createAppWindow();
        const d = w.document;
        const steg = w.eval('NASTA_STEG');
        for (const { tab, label } of Object.values(steg)) {
            const meny = d.querySelector(`.nav-item[data-tab="${tab}"] .nav-etikett`);
            expect(meny, tab).toBeTruthy();
            expect(label, tab).toBe(meny.textContent.trim());
        }
    });
    it('sidhuvudets fyra knappar har texten i ett eget element, som telefonbredden döljer visuellt men inte för skärmläsare', () => {
        const w = createAppWindow();
        const d = w.document;
        const namn = { 'btn-open-symbols': 'Förklaring', 'btn-forhandsvisa': 'Som i exporten', 'btn-open-installningar': 'Inställningar', 'btn-open-glossary': 'Ordlista' };
        for (const [id, text] of Object.entries(namn)) {
            const b = d.getElementById(id);
            expect(b.querySelector('.knapp-text')?.textContent, id).toBe(text);
            expect(b.querySelector('svg'), id).toBeTruthy();
            expect(b.title.length, id).toBeGreaterThan(3);
        }
        const css = las('src/style.css');
        const regel = css.match(/\.header-knappar > \.btn \.knapp-text \{([^}]*)\}/);
        expect(regel).toBeTruthy();
        expect(regel[1]).toMatch(/clip-path: inset\(50%\)/);
        expect(regel[1]).not.toMatch(/visibility|display: none/);
        expect(css).toMatch(/body\.meny-utan-glidning \.sidebar \{ transition: none !important; \}/);
    });
    it('Regler & praxis: områdena är avsnitt vars pil vrids när de fälls ut', () => {
        const w = createAppWindow();
        const omraden = [...w.document.querySelectorAll('.bes8-omrade')];
        expect(omraden).toHaveLength(6);
        for (const o of omraden) expect(o.matches('details.avsnitt'), o.id).toBe(true);
        const css = las('src/style.css');
        expect(css).toMatch(/details\.avsnitt > summary::before \{[^}]*transform: rotate\(-45deg\)/);
        expect(css).toMatch(/details\.avsnitt\[open\] > summary::before \{ transform: rotate\(45deg\); \}/);
    });
    it('Regler & praxis: Stöd i verktyget hämtar flikens tal och slutar med Gå dit; utan underlag står den fasta texten', () => {
        const w = createAppWindow();
        const d = w.document;
        const rader = () => [...d.querySelectorAll('.bes8-stod')];
        expect(rader().map(l => l.dataset.stod)).toEqual(['likvardighet', 'matrix', 'struktur']);
        const fast = rader().map(l => l.textContent.trim());
        for (const l of rader()) { expect(l.querySelector('a')).toBeNull(); expect(l.textContent).not.toContain('Gå dit'); }
        w.__lasInDemodata();
        w.__ritaFlik('bestammelser');
        for (const l of rader()) {
            const a = l.querySelector('a[data-go-to-tab]');
            expect(a?.dataset.goToTab, l.dataset.stod).toBe(l.dataset.stod);
            expect(a.textContent).toBe('Gå dit');
            expect(a.getAttribute('aria-label')).toMatch(/^Gå dit: /);
            expect(l.textContent, l.dataset.stod).toMatch(/\d/);
            expect(l.textContent.trim(), l.dataset.stod).not.toBe(fast[rader().indexOf(l)]);
        }
        // Talen är flikarnas egna: samma som i flikarnas toppar.
        w.__ritaFlik('matrix');
        w.__ritaFlik('likvardighet');
        w.__ritaFlik('struktur');
        const topp = (id, etikett) => [...d.querySelectorAll(`#${id} .slutsats`)].find(s => s.textContent.includes(etikett))?.querySelector('.slutsats-varde')?.textContent.trim();
        const [lv, la, st] = rader().map(l => l.textContent);
        expect(la).toContain(`har ${topp('la-slutsatser', 'AID-etiketter att granska')} AID-etiketter i BAS-intervall att granska`);
        expect(lv).toContain(`har ${topp('lv-slutsatser', 'Par att titta närmare på')} par att titta närmare på`);
        expect(st).toContain(`${topp('st-slutsatser', 'Högsta lönekvartilen')} kvinnor i den högsta lönekvartilen`);
        expect(st).toContain(`${topp('st-slutsatser', 'Lägsta lönekvartilen')} i den lägsta`);
        // Gå dit byter flik.
        d.querySelector('.bes8-stod[data-stod="struktur"] a').click();
        expect(d.querySelector('.nav-item.active').dataset.tab).toBe('struktur');
        // Rensas underlaget står den fasta texten igen.
        w.__state.data = [];
        w.eval('bes8Stod()');
        expect(rader().map(l => l.textContent.trim())).toEqual(fast);
    });
});

describe('fokusmarkeringen', () => {
    const css = las('src/style.css');
    it('*:focus-visible står en gång i stilmallen', () => {
        expect(css.match(/^\*:focus-visible\s*\{/gm)).toHaveLength(1);
    });
    it('fältkomponentens fokusring har verktygets accent, inte den ljusa kanten', () => {
        const regel = css.match(/^\.falt-rad:focus-within\s*\{[^}]*\}/m)[0];
        expect(regel).toContain('box-shadow: 0 0 0 2px var(--primary)');
        expect(regel).not.toContain('--accent-kant');
    });
});

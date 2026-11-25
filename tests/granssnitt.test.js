// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Vakttester för gränssnittets beteende: det som ser lyckat ut ska vara lyckat, tal skrivs på ett sätt, och
// bildspråket är linjeikoner. Varje test faller om felet det vaktar kommer tillbaka. Delen här: talen, statusorden och
// exportknapparna; resten i granssnitt-vyer.test.js (riggen i helpers/granssnitt-rigg.js).
import { describe, it, expect } from 'vitest';
import { createAppWindow, delatFonster, utgangslage } from './helpers/app-harness.js';
import { las, medDecimalpunkt } from './helpers/granssnitt-rigg.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const demo = delatFonster(w => w.__lasInDemodata());
it('det delade fönstret står i utgångsläget', () => {
    expect(utgangslage(demo())).toEqual({ troskel: 10, dialoger: 0, flik: 'dashboard' });
});

describe('modalerna skriver tal på svenska', () => {
    it('Inställningar och «Vad lagras?» har inget tal med decimalpunkt', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.eval('oppnaInstallningar()');
        expect(medDecimalpunkt(w.document.getElementById('installningar-modal'))).toEqual([]);
        w.eval('oppnaVadLagras()');
        expect(medDecimalpunkt(w.document.getElementById('data-residency-modal'))).toEqual([]);
    });
    it('beräkningsbevisen har inget tal med decimalpunkt', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const fel = {};
        let oppnade = 0;
        for (const flik of ['matrix', 'prioritering', 'likvardighet', 'utforska', 'kon']) {
            w.__ritaFlik(flik);
            const knappar = [...w.document.querySelectorAll('.evidence-btn, [data-evidence], .btn-evidence, button[class*="evidence"], button[class*="bevis"], [data-bevis]')];
            for (const b of knappar.slice(0, 400)) {
                b.click();
                const m = w.document.getElementById('evidence-modal');
                if (m.style.display !== 'flex') continue;
                oppnade++;
                const t = medDecimalpunkt(m);
                if (t.length) (fel[flik] = fel[flik] || new Set()).add(t[0]);
                w.eval('_stangBevisruta()');
            }
        }
        expect(oppnade).toBeGreaterThan(10);
        expect(Object.fromEntries(Object.entries(fel).map(([k, v]) => [k, [...v].slice(0, 8)]))).toEqual({});
    }, 60000);
});

describe('samma tal i samma precision på sidan', () => {
    it('regressionskortet skriver den oförklarade skillnaden med en decimal, som flikens nyckeltal', () => {
        const w = demo();
        w.__ritaFlik('struktur');
        const tal = w.document.querySelector('.reg-hero .hero-number').textContent.trim();
        expect(tal).toMatch(/^[+\u2212-]?\d+,\d\s%$/);
        expect(w.document.querySelector('.reg-hero .hero-label').textContent).toBe('Oförklarad löneskillnad, kvinnor mot män');
        expect(w.document.querySelector('.reg-hero .hero-meta').textContent).not.toMatch(/\d,\d\d\s%/);
    });
    it('Prioriteringens tabell skriver avvikelsen med en decimal', () => {
        const w = demo();
        w.__ritaFlik('prioritering');
        const tal = [...w.document.querySelectorAll('#prio-table .cell-bar-value')].map(e => e.textContent.trim()).filter(t => t !== '–');
        expect(tal.length).toBeGreaterThan(4);
        expect(tal.filter(t => !/^[+\u2212-]?\d+,\d\s%$/.test(t))).toEqual([]);
    });
});

describe('en exportknapp per kort', () => {
    const FLIKAR = ['dashboard', 'matrix', 'likvardighet', 'struktur', 'prioritering', 'loneoversyn', 'kon', 'benchmark', 'utforska'];
    it('varje diagram har en exportmeny, ingen behållare har två, och ingen fristående exportknapp står bredvid', () => {
        const w = demo();
        for (const flik of FLIKAR) w.__ritaFlik(flik);
        const d = w.document;
        const namn = el => (el.closest('.card, .diagramkort')?.querySelector('h2, h3, h4')?.textContent || el.id || '').trim().slice(0, 40);
        const varder = [...d.querySelectorAll('.view-panel .chart-export-host')];
        expect(varder.length).toBeGreaterThan(20);
        // Två menyer i samma behållare, eller en behållare inuti en annan, ger två knappar över varandra.
        expect(varder.filter(v => v.querySelectorAll(':scope > .chart-export').length !== 1).map(namn)).toEqual([]);
        expect(varder.filter(v => v.parentElement.closest('.chart-export-host')).map(namn)).toEqual([]);
        // Diagrammets meny är enda vägen till en bild: ingen knapp «Exportera PNG» eller «Exportera (CSV)» utanför menyerna.
        const aldre = [...d.querySelectorAll('.view-panel button')].filter(b => !b.closest('.chart-export-meny')
            && /^Exportera (PNG|\(CSV\))$/.test(b.textContent.trim()));
        expect(aldre.map(b => b.id || b.textContent)).toEqual([]);
        // Knappen säger vad den exporterar, så att två knappar över varandra inte båda heter Exportera.
        // Menyn Mer på Prioriteringens rader har exportmenyns form men är ingen export.
        const knappar = [...d.querySelectorAll('.view-panel .chart-export-btn')].filter(b => !b.closest('.prio-mer'));
        expect(knappar.length).toBeGreaterThan(20);
        expect(knappar.filter(b => !['Exportera diagrammet', 'Exportera tabellen'].includes(b.textContent.trim())).map(b => b.textContent.trim())).toEqual([]);
    });
    it('kandidatparens tabell har en meny Exportera med CSV och Excel', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        w.__ritaFlik('likvardighet');
        const meny = w.document.getElementById('lv-export-meny');
        const knapp = meny.parentElement.querySelector('.chart-export-btn');
        expect(knapp.textContent.trim()).toBe('Exportera tabellen');
        expect(meny.hidden).toBe(true);
        knapp.click();
        expect(meny.hidden).toBe(false);
        expect([...meny.querySelectorAll('button')].map(b => b.id)).toEqual(['btn-export-likvardighet-csv', 'btn-export-likvardighet']);
        let csv = 0;
        w.eval('_laddaNedCSV = () => { window.__csv = (window.__csv || 0) + 1; }');
        w.document.getElementById('btn-export-likvardighet-csv').click();
        csv = w.__csv;
        expect(csv).toBe(1);
        expect(meny.hidden).toBe(true);
    });
});

describe('raden om det markerade', () => {
    it('står överst i innehållet på samma plats i alla flikar, och urvalsraden säger inte samma sak en gång till', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const d = w.document;
        d.querySelector('.nav-item[data-tab="matrix"]').click();
        w.eval("sattDiagramMarkering('grupp:207024|B')");
        const rad = () => d.getElementById('markering-rad');
        expect(rad().parentElement.classList.contains('content-body')).toBe(true);
        expect(rad().parentElement.firstElementChild).toBe(rad());
        expect(rad().getAttribute('role')).toBe('status');
        expect([...rad().querySelectorAll('button')].map(b => b.textContent)).toEqual(['Öppna gruppdossier', 'Ta bort markeringen']);
        expect(rad().title).toContain('Ctrl-klicka');
        expect(d.querySelector('.markering-tips')).toBeNull();
        expect(d.getElementById('la-urval').textContent).not.toContain('Markerat');
        d.querySelector('.nav-item[data-tab="handlingsplan"]').click();
        expect(d.querySelectorAll('#markering-rad').length).toBe(1);
        rad().querySelector('[data-markering="rensa"]').click();
        expect(rad()).toBeNull();
    });
    it('stilmallen lägger inte raden fast över sidan', () => {
        const regel = /\.markering-rad \{[^}]*\}/.exec(las('src/style.css'))[0];
        expect(regel).not.toContain('position: fixed');
        expect(regel).toContain('position: sticky');
    });
});

describe('samma skillnad sägs på ett sätt', () => {
    it('Att göra skriver den råa skillnaden per BAS som kvinnors lön i procent av mäns, som Lika arbete', () => {
        const w = demo();
        const punkter = w.eval('byggAtgardslista()').filter(p => p.id.startsWith('gap-bas-'));
        expect(punkter.length).toBeGreaterThan(0);
        for (const p of punkter) {
            expect(p.titel).toMatch(/^BAS \S+: kvinnors medianlön \d+,\d\s% av mäns$/);
            expect(p.titel).not.toMatch(/lägre|högre/);
        }
        w.__ritaFlik('matrix');
        const kvoter = [...w.document.querySelectorAll('#la-oversikt tbody tr')].map(tr => tr.textContent);
        const b = punkter[0].titel.match(/^BAS (\S+): kvinnors medianlön (\d+,\d)\s%/);
        expect(kvoter.some(t => t.includes(`BAS ${b[1]}`) && t.replace(/\s/g, ' ').includes(`${b[2]} %`))).toBe(true);
    });
    it('där skillnaden står kvar heter den skillnad, och den oförklarade skillnaden har en decimal där den står som huvudtal', () => {
        const w = demo();
        w.__ritaFlik('matrix');
        w.__ritaFlik('loneoversyn');
        const d = w.document;
        const tvaDec = el => /[+\u2212-]?\d+,\d\d\s%/.test(el.textContent);
        const ytor = ['.reg-hero', '.reg-kronor-head', '#la-slutsatser', '#lo-slutsatser', '#forecast-outcome'];
        for (const sel of ytor) {
            const el = d.querySelector(sel);
            expect(el, sel).toBeTruthy();
            const blad = [...el.querySelectorAll('*')].filter(e => !e.children.length && !e.closest('.info-tip') && !/PO\b/.test(e.textContent));
            expect(blad.filter(tvaDec).map(e => e.textContent.trim().slice(0, 50)), sel).toEqual([]);
        }
        const kort = [...d.querySelectorAll('#la-slutsatser .slutsats')].find(k => k.textContent.includes('Efter ålder och BAS-intervall'));
        expect(kort.textContent).toContain('kvinnors lön i % av mäns när dessa räknats bort');
    });
});

describe('Regler & praxis visar vad som är bedömt', () => {
    const satt = (w, n, status) => { const s = w.document.getElementById('bes8-status-' + n); s.value = status; s.dispatchEvent(new w.Event('change', { bubbles: true })); };
    const tal = w => [...w.document.querySelectorAll('#rp-slutsatser .slutsats')].map(k => [k.querySelector('.slutsats-etikett').textContent, k.querySelector('.slutsats-varde').textContent]);
    it('nyckeltalen överst räknar bedömda områden, åtgärder och möjliga risker', () => {
        const w = createAppWindow();
        expect(tal(w)).toEqual([['Bedömda områden', '0 av 6'], ['Åtgärd krävs', '0'], ['Möjlig risk', '0']]);
        satt(w, 1, 'Åtgärd krävs');
        satt(w, 3, 'Möjlig risk – utreds vidare');
        satt(w, 4, 'Ingen risk identifierad');
        expect(tal(w)).toEqual([['Bedömda områden', '3 av 6'], ['Åtgärd krävs', '1'], ['Möjlig risk', '1']]);
    });
    it('varje område är ett avsnitt med statusen i rubrikraden, och rubriken i Word-utkastet är oförändrad', () => {
        const w = createAppWindow();
        const d = w.document;
        const omraden = [...d.querySelectorAll('#view-bestammelser details.bes8-omrade')];
        expect(omraden.length).toBe(6);
        expect(omraden.every(o => o.classList.contains('avsnitt') && o.querySelector('summary .avsnitt-titel h3') && o.querySelector('summary .avsnitt-nyckel'))).toBe(true);
        expect(d.getElementById('nyckel-rp-2').textContent).toBe('Ej bedömt');
        satt(w, 2, 'Åtgärd krävs');
        const marke = d.getElementById('nyckel-rp-2');
        expect(marke.textContent.trim()).toBe('Åtgärd krävs');
        expect(marke.querySelector('svg.ikon')).toBeTruthy();
        expect(marke.classList.contains('ar-kritisk')).toBe(true);
        expect(w.eval('_bes8Omraden()')[1].title).toBe('2. Lönerevisionsprocessen (löneöversyn)');
        satt(w, 2, '');
        expect(d.getElementById('nyckel-rp-2').textContent).toBe('Ej bedömt');
    });
    it('statusen följer med när allt rensas och när en konfigurationsfil läses in', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        satt(w, 5, 'Ej tillämplig');
        const cfg = w.eval('JSON.stringify(byggKonfiguration())');
        w.confirm = () => true;
        w.eval('rensaAllData()');
        expect(w.document.getElementById('nyckel-rp-5').textContent).toBe('Ej bedömt');
        expect(tal(w)[0][1]).toBe('0 av 6');
        w.__lasInDemodata();
        w.eval(`tillampaKonfiguration(${cfg})`);
        expect(w.document.getElementById('nyckel-rp-5').textContent.trim()).toBe('Ej tillämplig');
        expect(tal(w)[0][1]).toBe('1 av 6');
    });
    it('fliken påstår inte att svaren inte sparas', () => {
        expect(las('src/index.html')).not.toContain('Verktyget sparar inga svar');
    });
});

describe('ett statusordförråd och ett mått i nyckeltalen', () => {
    const fil = namn => readFileSync(fileURLToPath(new URL('../' + namn, import.meta.url)), 'utf8');
    it('de gamla statusorden finns inte kvar i bygget eller sidan', () => {
        for (const namn of ['dist/app.js', 'src/index.html']) {
            const text = fil(namn);
            for (const gammalt of ['Inom 3 %', 'Avviker mer än 5', 'Avviker 3–5', 'Värt att följa upp', 'rå skillnad, hela organisationen']) {
                expect(text.includes(gammalt), `${gammalt} i ${namn}`).toBe(false);
            }
        }
    });
    it('Förklaringen nämner varje statusord en gång, med färgen bunden till ordet', () => {
        const d = demo().document;
        const ord = [...d.querySelectorAll('#symbols-modal strong')].map(e => [e.textContent.trim(), e.className]);
        for (const [namn, klass] of [['Balanserat', 'farg-ok'], ['Följ upp', 'farg-varning'], ['Värt att granska', 'farg-granska'], ['Börja här', 'farg-granska'], ['Under referens, liten grupp', 'farg-granska'], ['Nära referens, under', 'farg-varning'], ['Nära referens', 'farg-ok'], ['Över referens', 'farg-info']]) {
            expect(ord.filter(o => o[0] === namn), namn).toEqual([[namn, klass]]);
        }
        // Ingen separat färgtabell som upprepar orden.
        expect([...d.querySelectorAll('#symbols-modal h3')].map(h => h.textContent)).not.toContain('Färger för avvikelser och status');
    });
    it('Lika arbete och Prioritering säger samma ord med samma färg', () => {
        const w = demo();
        w.__ritaFlik('matrix');
        const d = w.document;
        // Går ej att bedöma (ett kön under golvet, ADR-59) är grå: ingen allvarlighetsgrad.
        const farg = { 'Balanserat': 'ok', 'Följ upp': 'varning', 'Värt att granska': 'granska', 'Går ej att bedöma': 'neutral' };
        const bas = [...d.querySelectorAll('#la-oversikt tbody .la-status')];
        expect(bas.length).toBeGreaterThan(0);
        for (const el of bas) expect(el.classList.contains('ar-' + farg[el.textContent.trim()]), el.textContent).toBe(true);
        const yrke = [...d.querySelectorAll('#matrix-table tbody .la-status:not(.la-status-liten)')];
        for (const el of yrke) {
            const namn = Object.keys(farg).find(k => el.textContent.includes(k));
            expect(namn, el.textContent).toBeTruthy();
            expect(el.classList.contains('farg-' + (namn === 'Går ej att bedöma' ? 'dampad' : farg[namn]))).toBe(true);
        }
        const prio = w.eval('Object.values(PRIO_STATUS_INFO)');
        // Prioriteringen har egna ord för läget mot referensen (ADR-62); färgerna följer trappans.
        expect(prio.map(p => p.label)).toEqual(['Börja här', 'Under referens, liten grupp', 'Nära referens, under', 'Nära referens', 'Över referens']);
        expect(prio.map(p => p.klass)).toEqual(['bricka-granska', 'bricka-granska', 'bricka-varning', 'bricka-ok', 'bricka-info']);
    });
    it('livscykelns nyckeltal är kvinnors lön i % av mäns, och modellens skillnad står bredvid', () => {
        const w = demo();
        w.__ritaFlik('kon');
        w.eval('ritaLivscykel()');
        const d = w.document, r = w.eval('korLivscykelregression(_livscykelValdBas)');
        const pct = v => v.toFixed(1).replace('.', ',') + '\u00a0%';
        const rutor = [...d.querySelectorAll('#livscykel-content .stat-box')].map(b => [b.querySelector('.stat-etikett').textContent, b.querySelector('.fs-xl')?.textContent.trim()]);
        expect(rutor[0]).toEqual(['Kvinnors lön i % av mäns, 25 år', pct(100 + r.gapAt25)]);
        expect(rutor[1]).toEqual(['Kvinnors lön i % av mäns, 65 år', pct(100 + r.gapAt65)]);
        // Färgen följer trappan (ADR-59), med statusens ikon bredvid talet och ordet i verktygstipset.
        const tal = [...d.querySelectorAll('#livscykel-content .stat-box .fs-xl')].slice(0, 2);
        tal.forEach((el, i) => {
            const st = w.eval(`gapStatusNiva(${JSON.stringify(i ? r.niva65 : r.niva25)})`);
            expect(el.dataset.niva).toBe(st.niva);
            expect(el.getAttribute('title')).toBe(st.serie);
            expect(el.querySelector('svg.ikon-' + st.ikon)).not.toBeNull();
            expect(el.className).not.toMatch(/fg-kritisk/);
        });
        expect(d.querySelector('#livscykel-content .livscykel-kvot-not').textContent).toContain('Modellen ger skillnaden i procent');
    });
    it('modelljämförelsen när huvudregressionen inte kunde skattas: streck i huvudmodellens kolumn, aldrig "undefined"', () => {
        const w = demo();
        w.__ritaFlik('kon');
        w.eval('ritaLivscykel({ error: "x" })');
        const rader = [...w.document.querySelectorAll('#livscykel-modelljamforelse tbody tr')].map(tr => [...tr.cells].map(c => c.textContent.trim()));
        expect(rader[0][0]).toBe('Antal personer');
        expect(rader.slice(0, 4).map(r => r[1])).toEqual(['—', '—', '—', '—']);
        expect(w.document.getElementById('livscykel-content').textContent).not.toContain('undefined');
    });
    it('förändringen 25–65 år färgas på prövningen av samspelet mellan kön och ålder, inte på storleken', () => {
        const w = demo();
        w.__ritaFlik('kon');
        // Samma modell med andra p-värden för samspelet och en annan förändring: bara prövningen avgör färgen.
        const ruta = (kvAgePVal, kvAge2PVal, gapDelta) => {
            w.eval(`globalThis.__lcOrig = korLivscykelregression; korLivscykelregression = b => ({ ...__lcOrig(b), kvAgePVal: ${kvAgePVal}, kvAge2PVal: ${kvAge2PVal}, gapDelta: ${gapDelta} });`);
            try { w.eval('ritaLivscykel()'); }
            finally { w.eval('korLivscykelregression = __lcOrig; delete globalThis.__lcOrig;'); }
            const box = [...w.document.querySelectorAll('#livscykel-content .stat-box')]
                .find(b => b.querySelector('.stat-etikett').textContent.startsWith('Förändring 25–65 år'));
            return { tal: box.querySelector('.fs-xl'), sr: box.querySelector('.sr-only')?.textContent };
        };
        // Säkerställd (p < 0,10, samma gräns som tolkningen), också när förändringen är liten: varningsfärg.
        const saker = ruta(0.04, 0.5, 0.5);
        expect(saker.tal.classList.contains('farg-varning')).toBe(true);
        expect(saker.tal.getAttribute('title')).toBe('säkerställd förändring');
        expect(saker.sr).toBe('säkerställd förändring');
        // Inte säkerställd, också när förändringen är stor: neutral, inte grön och inte varning.
        const inte = ruta(0.4, 0.5, -4);
        expect(inte.tal.classList.contains('farg-dampad')).toBe(true);
        expect(inte.tal.className).not.toMatch(/varning|farg-ok|fg-ok/);
        expect(inte.tal.getAttribute('title')).toBe('inte säkerställd');
        expect(inte.sr).toBe('inte säkerställd');
        w.eval('ritaLivscykel()');
    });
    it('livscykeln säger "inte säkerställd" i ord, stjärnorna förklaras, och modellformeln står i beräkningspanelen', () => {
        const w = demo();
        w.__ritaFlik('kon');
        w.eval('ritaLivscykel()');
        const d = w.document, r = w.eval('korLivscykelregression(_livscykelValdBas)');
        const lop = d.getElementById('livscykel-content').textContent;
        expect(lop).not.toMatch(/(^|[\s(>])ns([\s).,<]|$)/);   // \b räcker inte: å, ä och ö räknas inte som bokstäver där
        expect(lop).not.toMatch(/log\(lön\)|HC3|C\(BAS\)|referensintervall/);
        const saker = [...d.querySelectorAll('#livscykel-content .stat-box')].find(b => /säkerställd\?/.test(b.textContent));
        const ord = p => p < 0.10 ? 'säkerställd' : 'inte säkerställd';
        expect(saker.querySelector('.livscykel-provning').textContent.replace(/\s+/g, ' ')).toContain(`Linjär: p = ${r.kvAgePVal < 0.001 ? '< 0,001' : r.kvAgePVal.toFixed(3).replace('.', ',')}, ${ord(r.kvAgePVal)}`);
        expect(d.querySelector('#livscykel-content .livscykel-stjarnor').textContent).toContain('*** p < 0,001');
        expect(d.querySelector('#livscykel-content .livscykel-modell-not').textContent)
            .toMatch(/bygger på [\d\s\u00a0]+ personer och tar hänsyn till kön, ålder, åldern i kvadrat.*samspelet mellan kön och ålder.*BAS-intervall.*Så räknas det.*Beräkning & urval/s);
        // Beräkningspanelen i flikens Så räknas det har formeln, standardfelen och referensintervallet.
        const panel = d.querySelector('details.audit-panel[data-audit-id="livscykel"]');
        expect(panel.closest('details.avsnitt').querySelector('summary h2').textContent).toBe('Så räknas det');
        expect(panel.closest('.view-panel').id).toBe('view-livscykel');
        const innehall = panel.querySelector('.audit-content').textContent;
        expect(innehall).toContain('log(lön) ~ kön + ålder + ålder² + kön×ålder + kön×ålder² + C(BAS)');
        expect(innehall).toContain('HC3-robusta standardfel');
        expect(innehall).toContain(`BAS ${r.refBas} referensintervall`);
        expect(w.eval('metodikregister.livscykel').usedInAnalysis).toBe(r.n);
    });
});

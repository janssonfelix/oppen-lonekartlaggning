// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Gruppdossiern i appen: dossiern, robusthetsanalysen och färdigchecken, och att robusthetspanelen följer minsta
// gruppstorlek.
import { describe, it, expect, beforeAll } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { medDecimalpunkt } from './helpers/granssnitt-rigg.js';

let win;

beforeAll(() => {
    win = createAppWindow();
    win.__lasInDemodata();   // blocken nedan läser demodatan
});

describe('handläggarstöd: gruppdossier, robusthet, färdigcheck', () => {
    it('okänd nyckel ger null i stället för att kasta', () => {
        expect(win.__byggGruppdossier('finns-inte|Z')).toBeNull();
    });

    it('textversionen innehåller gränsdragningen mot sakliga skäl', () => {
        const d = win.__byggGruppdossier(win.__gruppdossierKandidater()[0].key);
        const txt = win.__gruppdossierSomText(d);
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
        const items = win.__byggFardigcheck();
        expect(Array.isArray(items)).toBe(true);
        items.forEach(i => {
            expect(['warn', 'info']).toContain(i.level);
            expect(typeof i.title).toBe('string');
            expect(i.title.length).toBeGreaterThan(0);
            expect(typeof i.detail).toBe('string');
        });
    });

    it('kvalitetssäkringsfliken renderar båda panelerna utan kast', () => {
        expect(() => win.__ritaKvalitetssakring()).not.toThrow();
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
        win.__lasInDemodata();
        const key = win.__gruppdossierKandidater()[0].key;
        win.__oppnaGruppdossier(key);
        const modal = win.document.getElementById('dossier-modal');
        expect(modal.style.display).toBe('flex');
        expect(win.document.getElementById('dossier-select').value).toBe(key);
        expect(win.document.getElementById('dossier-body').innerHTML.length).toBeGreaterThan(50);
        win.__stangGruppdossier();
        expect(modal.style.display).toBe('none');
    });

    it('robusthetspanelen visar en startknapp i stället för att räkna direkt', () => {
        win.__ritaKvalitetssakring();
        const host = win.document.getElementById('robusthet-body');
        expect(host.querySelector('#btn-run-robusthet')).not.toBeNull();
        // färdigchecken är billig och körs direkt
        expect(win.document.getElementById('fardigcheck-body').innerHTML.length).toBeGreaterThan(20);
    });

    it('robusthetsanalysen producerar resultat när den körs', async () => {
        win.__korRobusthet();
        await new Promise(r => setTimeout(r, 120));   // renderingen är fördröjd för att hinna måla om
        const host = win.document.getElementById('robusthet-body');
        expect(host.innerHTML).toMatch(/Likvärdigt arbete|Prioritering/);
    });
});

describe('k-anonymitet, sortering, efterlevnad och dossiern — dossiern', () => {
    it('hypotesrutan i dossiern renderar markup i stället för att visa taggar', () => {
        win.__lasInDemodata();
        const key = win.__gruppdossierKandidater()[0].key;
        const d = win.__byggGruppdossier(key);
        win.__oppnaGruppdossier(key);
        const body = win.document.getElementById('dossier-body');
        expect(body.innerHTML).not.toContain('&lt;strong&gt;');
        if (d.suggestions.length) {
            // textkopian ska däremot vara fri från markup
            expect(win.__gruppdossierSomText(d)).not.toMatch(/<\/?strong>/);
        }
        win.__stangGruppdossier();
    });
});

describe('robusthetspanelen följer minsta gruppstorlek (ADR-38)', () => {
    // Ett kandidatpar: 6 kvinnor i yrke 5300 (BAS C) mot 20 män i yrke 6100 — den lilla gruppen är under tröskeln 10.
    const fonster = () => {
        const w = createAppWindow();
        const rader = [];
        const lagg = (n, kon, lon, bas, aid) => { for (let i = 0; i < n; i++) rader.push({ bas, kon, lon: lon + (i % 3) * 10,
            alder: 30 + (i * 7) % 30, yrke: `${aid} Yrke ${aid}`, aid, yrkeLabel: `Yrke ${aid}`, enhet: '' }); };
        lagg(30, 'kvinna', 25000, 'A', '6000'); lagg(30, 'man', 25500, 'A', '6000');
        lagg(20, 'man', 50000, 'C', '6100'); lagg(4, 'kvinna', 50000, 'C', '6100');
        lagg(6, 'kvinna', 36421, 'C', '5300');
        w.__state.data = rader;
        w.eval('fyllValjare(); lasUppFlikar();');
        w.__state.kLage = 'export';   // panelen hör till Exportera och ritas alltid i exportläget (ADR-51)
        return w;
    };
    it('paret med en grupp under tröskeln namnges inte; antalet utelämnade par står i panelen och i resultatet', () => {
        const w = fonster();
        const r = w.__robusthetLikvardighet([55, 60, 65]);
        expect(r.utelamnade).toBe(1);
        expect(r.rows).toEqual([]);
        expect(r.not).toBe('1 par med en grupp under 10 personer redovisas inte här.');
        w.eval("_ritaRobusthetResultat(document.getElementById('robusthet-body'))");
        const t = w.document.getElementById('robusthet-body').textContent;
        expect(t).not.toContain('5300');
        expect(t).toContain('1 par med en grupp under 10 personer redovisas inte här.');
        expect(t).toContain('Inga kandidatpar att namnge');
        // Slutsatsraden räknar bara de namngivna paren som prövade slutsatser.
        expect(w.document.getElementById('nyckel-dk-robusthet').textContent).toBe('Står sig');
    });
    it('vid 5 namnges paret och ingen mening om utelämnade står kvar', () => {
        const w = fonster();
        w.eval('sattKTroskel(5, { fraga: false })');
        const r = w.__robusthetLikvardighet([55, 60, 65]);
        expect(r.utelamnade).toBe(0);
        expect(r.not).toBe('');
        expect(r.rows.some(x => x.label.includes('5300'))).toBe(true);
        w.eval("_ritaRobusthetResultat(document.getElementById('robusthet-body'))");
        const t = w.document.getElementById('robusthet-body').textContent;
        expect(t).toContain('5300');
        expect(t).not.toMatch(/redovisas inte här/);
    });
});

describe('gruppdossiern', () => {
    it('prioriteringens läge heter som i Prioritering, på skärmen och i textkopian', () => {
        const etiketter = Object.values(win.eval('PRIO_STATUS_INFO')).map(i => i.label);
        const d = win.__gruppdossierKandidater().map(g => win.__byggGruppdossier(g.key)).find(x => x && x.prio);
        expect(d).toBeTruthy();
        const rad = win.__gruppdossierSomText(d).split('\n').find(r => r.startsWith('Prioritering: '));
        expect(etiketter).toContain(rad.slice('Prioritering: '.length).split(' · ')[0]);
        win.eval(`oppnaGruppdossier(${JSON.stringify(d.key)})`);
        const kort = [...win.document.querySelectorAll('#dossier-body .gd-card')].find(c => /Hur angeläget/.test(c.textContent));
        expect(etiketter).toContain(kort.querySelector('strong').textContent);
        win.eval('stangGruppdossier()');
    });

    it('Kopiera: en grupp under tröskeln säger att den inte kopieras, och nekat urklipp går via textfältet', async () => {
        const w = createAppWindow(); w.__lasInDemodata();
        w.eval('sattKTroskel(25, { fraga: false })');   // demots grupper har minst 10 personer
        const larm = [], kopior = [];
        w.alert = t => larm.push(t);
        w.document.execCommand = kom => { kopior.push([kom, w.document.body.lastElementChild?.value]); return true; };
        const liten = w.__gruppdossierKandidater().find(g => g.rows.length < 25);
        expect(liten).toBeTruthy();
        w.eval(`oppnaGruppdossier(${JSON.stringify(liten.key)})`);
        w.navigator.clipboard = { writeText: () => Promise.reject(new Error('nekad')) };
        w.document.getElementById('btn-dossier-copy').click();
        await new Promise(r => setTimeout(r, 0));
        expect(larm).toEqual(['Gruppen har färre än 25 personer och kopieras inte.']);
        expect(kopior).toEqual([]);
        const stor = w.__gruppdossierKandidater().find(g => g.rows.length >= 25);
        w.eval(`oppnaGruppdossier(${JSON.stringify(stor.key)})`);
        w.document.getElementById('btn-dossier-copy').click();
        await new Promise(r => setTimeout(r, 0));
        expect(kopior).toHaveLength(1);
        expect(kopior[0][0]).toBe('copy');
        expect(kopior[0][1]).toMatch(/^Gruppdossier: /);
    });

    it('gruppNamn skriver koden en gång', () => {
        const w = createAppWindow();
        const namn = g => w.eval(`gruppNamn(${JSON.stringify(g)})`);
        expect(namn({ aid: '207024', yrke: '207024 Vårdbiträde' })).toBe('207024 Vårdbiträde');
        expect(namn({ aid: '207024', yrke: 'Vårdbiträde' })).toBe('207024 Vårdbiträde');
        expect(namn({ aid: '207024', yrke: '207024' })).toBe('207024');
        expect(namn({ aid: '207024', yrke: '' })).toBe('207024');
        expect(namn({ aid: '207024', yrke: '207024 (3 yrkesbenämningar)' })).toBe('207024 (3 yrkesbenämningar)');
    });
    it('rubriken, väljaren och textkopian dubblerar inte AID-koden, och inget tal har decimalpunkt', () => {
        const w = createAppWindow();
        w.__lasInDemodata();
        const kandidater = w.eval('gruppdossierKandidater().map(g => ({ key: g.key, aid: g.aid }))');
        expect(kandidater.length).toBeGreaterThan(3);
        const fel = [];
        for (const k of kandidater) {
            w.eval(`oppnaGruppdossier(${JSON.stringify(k.key)})`);
            const modal = w.document.getElementById('dossier-modal');
            const rubrik = modal.querySelector('.gd-head h3').textContent;
            const val = modal.querySelector('select').selectedOptions[0].textContent;
            const text = w.eval(`gruppdossierSomText(byggGruppdossier(${JSON.stringify(k.key)}))`);
            for (const t of [rubrik, val, text.split('\n')[0]]) if (t.includes(`${k.aid} ${k.aid}`)) fel.push(t);
            fel.push(...medDecimalpunkt(modal));
            if (/\d\.\d/.test(text)) fel.push(text.split('\n').find(r => /\d\.\d/.test(r)));
        }
        expect(fel).toEqual([]);
    }, 30000);
});

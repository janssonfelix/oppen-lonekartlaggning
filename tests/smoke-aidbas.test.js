// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Tabellerna per AID-kod och BAS-intervall i verktyget (45-aid-bas-tabeller.js): avsnitten i Lika arbete och
 * Likvärdigt arbete, de fyra Excel-bladen med exakt rapportens kolumnnamn, inställningarna (definition och lönemånad)
 * och rättningen av trattens underlag (fliken Slumpens gränser räknar per AID-kod och BAS-intervall).
 *
 * Underlaget är helt påhittat: 58 personer, samma fall som tests/aidbas.test.js, och en yrkesgrupp i två intervall
 * med båda könen över tröskeln så att tratten har två punkter för samma AID-kod.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppWindow } from './helpers/app-harness.js';
import { laddaXlsx } from './helpers/ktroskel-rigg.js';

vi.setConfig({ testTimeout: 30000 });

const rad = (bas, aid, kon, lon, label = `Yrke ${aid}`) => ({ bas, aid, yrke: `${aid} ${label}`, yrkeLabel: label, kon, lon, alder: 40, enhet: '' });
const grupp = (bas, aid, kon, n, lon0, steg = 100) => Array.from({ length: n }, (_, i) => rad(bas, aid, kon, lon0 + i * steg));
const UNDERLAG = [
    ...grupp('C', '1001', 'kvinna', 2, 30000), ...grupp('C', '1001', 'man', 2, 30500),           // 4 personer: under golvet
    ...grupp('A', '1001', 'man', 9, 46000), ...grupp('A', '1001', 'kvinna', 1, 46500),           // mansdominerad, lågt BAS, hög lön
    ...grupp('E', '2002', 'kvinna', 30, 38000), ...grupp('E', '2002', 'man', 9, 39000),           // 9 män: individnivå
    ...grupp('B', '3003', 'kvinna', 3, 32000), ...grupp('B', '3003', 'man', 2, 32000),            // exakt 60 % kvinnor
];
// 7007 i två BAS-intervall med 12 kvinnor och 12 män i varje: två punkter i tratten, två rader i tabellerna.
const TVA_BAS = [...grupp('D', '7007', 'kvinna', 12, 30000, 150), ...grupp('D', '7007', 'man', 12, 31000, 150),
                 ...grupp('F', '7007', 'kvinna', 12, 34000, 150), ...grupp('F', '7007', 'man', 12, 34500, 150)];

function fonster(data = UNDERLAG) {
    const w = createAppWindow();
    w.__state.data = data;
    w.eval('populateSelects(); unlockTabs();');
    return w;
}
const tabell = (w, id) => {
    const t = w.document.getElementById(id);
    if (!t) return null;
    const rad = tr => [...tr.children].map(c => c.textContent.replace(/\s+/g, ' ').trim());   // Intl skriver mellanslag som U+00A0/U+202F
    return { rubriker: rad(t.tHead.rows[0]), rader: [...t.tBodies[0].rows].map(rad) };
};
async function bok(w) {
    await laddaXlsx(w);
    const wb = w.eval('_excelAlltBok()');
    const blad = n => w.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true });
    return { namn: wb.SheetNames, blad, celler: n => blad(n).flat() };
}

describe('Lika arbete: avsnitten Lika arbete AID x BAS och Analys på individnivå', () => {
    it('en rad per AID-kod och BAS-intervall, ur varje persons egen rad; på skärmen alla grupper', () => {
        const w = fonster([...UNDERLAG, ...TVA_BAS]);
        w.__renderTabContent('matrix');
        const t = tabell(w, 'aidbas-lika-tabell');
        expect(t.rubriker).toEqual(['BAS-intervall', 'AID-kod', 'Yrkesgrupp', 'Antal kvinnor', 'Antal män', 'Medianlön kvinnor', 'Medianlön män', 'Kvinnors median i % av mäns', 'Nedre gräns', 'Övre gräns', 'Bedömning']);
        expect(t.rader.map(r => `${r[0]} ${r[1]}`)).toEqual(['A 1001', 'B 3003', 'C 1001', 'D 7007', 'E 2002', 'F 7007']);   // skärmen: också 4 personer
        const e = t.rader.find(r => r[1] === '2002');
        expect(e.slice(3)).toEqual(['30', '9', '–', '–', '–', '–', '–', 'Analyseras på individnivå']);
        const d = t.rader.find(r => r[0] === 'D');
        expect(d[5]).toBe('30 825 kr'); expect(d[6]).toBe('31 825 kr');
        expect(d[7]).toMatch(/^9\d,\d %$/);
        expect(d[8]).toMatch(/^\d{2,3},\d %$/); expect(d[9]).toMatch(/^\d{2,3},\d %$/);
        expect(['Inom gränserna', 'Utanför gränserna']).toContain(d[10]);
        expect(w.document.getElementById('aidbas-lika').textContent).toContain('Lönemånad: inte angiven');
        // Arbetslistan: grupperna där något kön är under 10, utan löner.
        const i = tabell(w, 'aidbas-individ-tabell');
        expect(i.rubriker).toEqual(['BAS-intervall', 'AID-kod', 'Yrkesgrupp', 'Antal kvinnor', 'Antal män', 'Analys genomförd', 'Resultat']);
        expect(i.rader.map(r => `${r[0]} ${r[1]}`)).toEqual(['A 1001', 'B 3003', 'C 1001', 'E 2002']);
        expect(w.document.getElementById('aidbas-individ').textContent).not.toMatch(/\d{2} \d{3} kr/);
        expect(w.document.getElementById('nyckel-la-individ').textContent).toBe('4 grupper');
    });
    it('lönemånaden från Inställningar står ovanför tabellerna och följer med i konfigurationsfilen', () => {
        const w = fonster();
        const falt = w.document.getElementById('lonemanad');
        falt.value = '2026-10'; falt.dispatchEvent(new w.Event('change'));
        expect(w.__state.lonemanad).toBe('2026-10');
        w.__renderTabContent('matrix');
        expect(w.document.getElementById('aidbas-lika').textContent).toContain('Lönemånad: 2026-10');
        const cfg = w.eval('buildConfigSnapshot()');
        expect(cfg.lonemanad).toBe('2026-10');
        expect(cfg.likvardighet.kvDomDefinition).toBe('do');
        w.eval('applyConfigSnapshot(' + JSON.stringify({ ...cfg, lonemanad: '2025-11', likvardighet: { ...cfg.likvardighet, kvDomDefinition: 'scb' } }) + ')');
        expect(w.__state.lonemanad).toBe('2025-11');
        expect(w.__state.likvardighet.kvDomDefinition).toBe('scb');
        expect(() => w.eval('applyConfigSnapshot(' + JSON.stringify({ ...cfg, likvardighet: { kvDomDefinition: 'annat' } }) + ')')).toThrow(/kvDomDefinition/);
    });
});

describe('Likvärdigt arbete: avsnitten per BAS-intervall och den hierarkiska jämförelsen', () => {
    it('klassningen följer vald definition: exakt 60 % kvinnor är könsblandad enligt DO och kvinnodominerad enligt SCB', () => {
        const w = fonster();
        w.__renderTabContent('likvardighet');
        const t = tabell(w, 'aidbas-likvardigt-tabell');
        expect(t.rubriker).toEqual(['BAS-intervall', 'AID-kod', 'Yrkesgrupp', 'Antal', 'Andel kvinnor (%)', 'Andel kvinnor nationellt (%)', 'Klassning', 'Brukar anses kvinnodominerad', 'Medianlön', 'Lönespridning']);
        const b = () => tabell(w, 'aidbas-likvardigt-tabell').rader.find(r => r[1] === '3003');
        expect(b()[4]).toBe('60,0 %'); expect(b()[6]).toBe('Könsblandad'); expect(b()[8]).toBe('–');   // 5 personer: ingen median
        expect(w.document.getElementById('aidbas-likvardigt').textContent).toContain('DO: mer än 60 % kvinnor');
        const val = w.document.getElementById('lv-kv-definition');
        expect(val).not.toBeNull();
        val.value = 'scb'; val.dispatchEvent(new w.Event('change'));
        expect(w.__state.likvardighet.kvDomDefinition).toBe('scb');
        expect(b()[6]).toBe('Kvinnodominerad');
        expect(w.document.getElementById('aidbas-likvardigt').textContent).toContain('SCB: 60 % kvinnor eller mer');
        expect(w.document.getElementById('nyckel-lv-aidbas').textContent).toBe('4 grupper · 2 kvinnodominerade (SCB)');   // skärmen visar också gruppen med 4 personer
    });
    it('den hierarkiska jämförelsen listar paret, och texten om inga par när det inte finns något', () => {
        const w = fonster();
        w.__renderTabContent('likvardighet');
        const t = tabell(w, 'aidbas-hierarki-tabell');
        expect(t.rubriker).toEqual(['Grupp A (ej kvinnodominerad)', 'BAS A', 'Median A', 'Grupp B (kvinnodominerad)', 'BAS B', 'Median B', 'Skillnad (kr)', 'Skillnad (%)']);
        expect(t.rader).toEqual([['1001 Yrke 1001', 'A', '46 450 kr', '2002 Yrke 2002', 'E', '39 400 kr', '7 050 kr', '17,9 %']]);
        const w2 = fonster(TVA_BAS);
        w2.__renderTabContent('likvardighet');
        expect(tabell(w2, 'aidbas-hierarki-tabell')).toBeNull();
        expect(w2.document.getElementById('aidbas-hierarki').textContent).toContain('Inga fall där ett lägre värderat arbete som inte är kvinnodominerat har högre lön än ett högre värderat kvinnodominerat arbete.');
    });
});

describe('Excel (alla flikar): de fyra bladen', () => {
    it('bladen finns med exakt namn och kolumner; summan av kvinnor och män i tabell 1 och noten är underlaget', async () => {
        const w = fonster([...UNDERLAG, ...TVA_BAS]);
        const { namn, blad } = await bok(w);
        for (const n of ['Lika arbete AID x BAS', 'Likvärdigt arbete', 'Hierarkisk jämförelse', 'Analys på individnivå']) expect(namn).toContain(n);
        expect(w.eval('excelAlltBlad()')).toEqual(namn);   // förhandsbeskedet och arbetsboken har samma blad
        const lika = blad('Lika arbete AID x BAS');
        expect(lika[1]).toEqual(['Lönemånad: inte angiven']);
        const rubrik = lika.findIndex(r => r[0] === 'BAS-intervall');
        expect(lika[rubrik]).toEqual(['BAS-intervall', 'AID-kod', 'Yrkesgrupp', 'Antal kvinnor', 'Antal män', 'Medianlön kvinnor', 'Medianlön män', 'Kvinnors median i % av mäns', 'Nedre gräns', 'Övre gräns', 'Bedömning']);
        const rader = lika.slice(rubrik + 1).filter(r => r.length === 11);
        expect(rader.map(r => `${r[0]} ${r[1]}`)).toEqual(['A 1001', 'B 3003', 'D 7007', 'E 2002', 'F 7007']);   // exporten: 1001 i C (4 personer) i noten
        const not = lika.find(r => /färre än 5 personer/.test(String(r[0])))[0];
        expect(not).toContain('1001 Yrke 1001 · BAS C (2 kvinnor, 2 män)');
        const summa = rader.reduce((s, r) => s + r[3] + r[4], 0) + 2 + 2;
        expect(summa).toBe(UNDERLAG.length + TVA_BAS.length);
        // Inga medianer för ett kön under 10: raden för 2002 har tomma celler och bedömningen.
        const e = rader.find(r => r[1] === '2002');
        expect(e.slice(5)).toEqual(['', '', '', '', '', 'Analyseras på individnivå']);
        const d = rader.find(r => r[0] === 'D');
        expect(d[5]).toBe(30825); expect(d[6]).toBe(31825); expect(d[7]).toBeCloseTo(96.9, 1);
        expect(typeof d[8]).toBe('number'); expect(typeof d[9]).toBe('number');
        // Talformat i cellerna: kronor utan decimaler, procent med en.
        const ws = w.eval('_excelAlltBok()').Sheets['Lika arbete AID x BAS'];
        const celler = Object.entries(ws).filter(([k, c]) => !k.startsWith('!') && typeof c.v === 'number');
        expect(celler.some(([, c]) => c.z === '#,##0')).toBe(true);
        expect(celler.some(([, c]) => c.z === '#,##0.0')).toBe(true);
        // Tabell 2, 3 och 4
        const lv = blad('Likvärdigt arbete');
        expect(lv.find(r => r[0] === 'BAS-intervall')).toEqual(['BAS-intervall', 'AID-kod', 'Yrkesgrupp', 'Antal', 'Andel kvinnor (%)', 'Andel kvinnor nationellt (%)', 'Klassning', 'Brukar anses kvinnodominerad', 'Medianlön', 'Lönespridning']);
        expect(lv.some(r => r[0] === 'Sammanfattning per BAS-intervall: högsta och lägsta medianlön bland kvinnodominerade grupper och bland övriga; skillnaden är högsta median övriga mot högsta kvinnodominerad.')).toBe(true);
        expect(lv.filter(r => r.length === 10 && r[0] !== 'BAS-intervall').map(r => `${r[0]} ${r[1]}`)).toEqual(['A 1001', 'B 3003', 'D 7007', 'E 2002', 'F 7007']);
        const par = blad('Hierarkisk jämförelse');
        expect(par.find(r => r[0] === 'Grupp A (ej kvinnodominerad)')).toEqual(['Grupp A (ej kvinnodominerad)', 'BAS A', 'Median A', 'Grupp B (kvinnodominerad)', 'BAS B', 'Median B', 'Skillnad (kr)', 'Skillnad (%)']);
        expect(par.some(r => r[0] === '1001 Yrke 1001' && r[1] === 'A' && r[2] === 46450 && r[3] === '2002 Yrke 2002' && r[6] === 7050)).toBe(true);
        const ind = blad('Analys på individnivå');
        expect(ind.find(r => r[0] === 'BAS-intervall')).toEqual(['BAS-intervall', 'AID-kod', 'Yrkesgrupp', 'Antal kvinnor', 'Antal män', 'Analys genomförd', 'Resultat']);
        expect(ind.filter(r => r.length >= 5 && r[0] !== 'BAS-intervall').map(r => `${r[0]} ${r[1]}`)).toEqual(['A 1001', 'B 3003', 'E 2002']);
        expect(JSON.stringify(ind)).not.toMatch(/\b(3\d|4\d)\d{3}\b/);   // inga löner
        // Metodik beskriver tabellerna, gränserna och definitionen.
        const met = blad('Metodik').flat().join('\n');
        expect(met).toContain('Tabellerna per AID-kod och BAS-intervall');
        expect(met).toContain('Gränser för slumpen (Lika arbete AID x BAS, Slumpens gränser)');
        expect(met).toContain('DO: mer än 60 % kvinnor');
        expect(w.eval('_excelAlltBok()').Sheets['Metod & parametrar']).toBeDefined();
    });
    it('utan par står texten om inga fall i bladet Hierarkisk jämförelse', async () => {
        const w = fonster(TVA_BAS);
        const { blad } = await bok(w);
        expect(blad('Hierarkisk jämförelse').flat()).toContain('Inga fall där ett lägre värderat arbete som inte är kvinnodominerat har högre lön än ett högre värderat kvinnodominerat arbete.');
    });
});

describe('Slumpens gränser räknar per AID-kod och BAS-intervall', () => {
    it('en yrkesgrupp i två intervall får två rader med sitt eget intervall och sina egna antal', async () => {
        const w = fonster([...UNDERLAG, ...TVA_BAS]);
        const { blad } = await bok(w);
        const s = blad('Slumpens granser');
        const rader = s.filter(r => r[0] === '7007 Yrke 7007');
        expect(rader.map(r => [r[1], r[2], r[3]])).toEqual([['D', 12, 12], ['F', 12, 12]]);
        expect(s.some(r => r[0] === '1001 Yrke 1001')).toBe(false);   // inget intervall har 10 av varje kön
        // Trattens underlag på skärmen: samma nyckel.
        w.__renderTabContent('matrix');
        const u = w.eval('_laTrattUnderlag(getData(), 10)');
        expect(u.punkter.map(p => p.nyckel).sort()).toEqual(['7007|D', '7007|F']);
    });
});

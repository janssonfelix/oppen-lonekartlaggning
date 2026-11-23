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
    w.eval('fyllValjare(); lasUppFlikar();');
    return w;
}
const tabell = (w, id) => {
    const t = w.document.getElementById(id);
    if (!t) return null;
    const rad = tr => [...tr.children].map(c => c.textContent.replace(/\s+/g, ' ').trim());   // Intl skriver mellanslag som U+00A0/U+202F
    return { rubriker: rad(t.tHead.rows[0]), rader: [...t.tBodies[0].rows].map(rad) };
};
/** Rubrikerna som grundvyn gömmer bakom Fler kolumner. */
const gomdaRubriker = (w, id) => [...w.document.querySelectorAll(`#${id} thead th`)].filter(th => th.hidden).map(th => th.textContent.trim());
async function bok(w) {
    await laddaXlsx(w);
    const wb = w.eval('_excelAlltBok()');
    const blad = n => w.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true });
    return { namn: wb.SheetNames, blad, celler: n => blad(n).flat() };
}

describe('[B5.5] Lika arbete: avsnitten Lika arbete AID x BAS och Analys på individnivå', () => {
    it('Lika arbetes grupper och status per AID-kod och BAS-intervall; på skärmen alla grupper med två av varje kön (ADR-90)', () => {
        const w = fonster([...UNDERLAG, ...TVA_BAS]);
        w.__ritaFlik('matrix');
        const t = tabell(w, 'aidbas-lika-tabell');
        expect(t.rubriker).toEqual(['BAS-intervall', 'AID-kod', 'Etikettnamn', 'Antal kvinnor', 'Antal män', 'Medianlön kvinnor', 'Medianlön män', 'Kvinnors median i % av mäns', 'Nedre gräns', 'Övre gräns', 'Status', 'Ojusterad löneskillnad ≥ 5 %']);
        // Grundvyn gömmer gränserna och direktivmarkeringen bakom Fler kolumner (F12); exporten har alla kolumner.
        expect(gomdaRubriker(w, 'aidbas-lika-tabell')).toEqual(['Nedre gräns', 'Övre gräns', 'Ojusterad löneskillnad ≥ 5 %']);
        // Samma grupper som tabellen per AID-etikett: 1001 i BAS A har en kvinna och jämförs inte.
        expect(t.rader.map(r => `${r[0]} ${r[1]}`)).toEqual(['B 3003', 'C 1001', 'D 7007', 'E 2002', 'F 7007']);
        expect(w.document.getElementById('aidbas-lika').textContent).toContain('1 grupp har färre än två kvinnor eller två män och jämförs inte.');
        // Ett kön under 10: medianerna står på skärmen (tröskeln 1), statusen prövas inte och gränserna saknas.
        const e = t.rader.find(r => r[1] === '2002');
        expect(e.slice(3, 5)).toEqual(['30', '9']);
        expect(e.slice(8, 11)).toEqual(['–', '–', 'Går ej att bedöma']);
        const d = t.rader.find(r => r[0] === 'D');
        expect(d[5]).toBe('30 825 kr'); expect(d[6]).toBe('31 825 kr');
        expect(d[7]).toMatch(/^9\d,\d %$/);
        expect(d[8]).toMatch(/^\d{2,3},\d %$/); expect(d[9]).toMatch(/^\d{2,3},\d %$/);
        // Statusen är densamma som i tabellen per AID-etikett, rad för rad.
        const huvud = tabell(w, 'matrix-table');
        for (const r of t.rader) {
            const h = huvud.rader.find(x => x[0].startsWith(`${r[1]} Yrke`) && x[1] === r[0]);
            expect(h, `${r[1]} ${r[0]}`).toBeDefined();
            expect(h[2].startsWith(r[10]), `${r[1]} ${r[0]}: ${h[2]} / ${r[10]}`).toBe(true);
        }
        expect(w.document.getElementById('aidbas-lika').textContent).toContain('Lönemånad: inte angiven');
        // Arbetslistan: grupperna där något kön är under 10, utan löner.
        const i = tabell(w, 'aidbas-individ-tabell');
        expect(i.rubriker).toEqual(['BAS-intervall', 'AID-kod', 'Etikettnamn', 'Antal kvinnor', 'Antal män', 'Analys genomförd', 'Resultat']);
        expect(i.rader.map(r => `${r[0]} ${r[1]}`)).toEqual(['A 1001', 'B 3003', 'C 1001', 'E 2002']);
        expect(w.document.getElementById('aidbas-individ').textContent).not.toMatch(/\d{2} \d{3} kr/);
        expect(w.document.getElementById('nyckel-la-individ').textContent).toBe('4 grupper');
        // Exporten (sist: den ritar fliken i exportläget) har alla kolumner.
        expect(w.__tabellTillMatris('aidbas-lika-tabell')[0]).toEqual(t.rubriker);
    });
    it('lönemånaden från Inställningar står ovanför tabellerna och följer med i konfigurationsfilen', () => {
        const w = fonster();
        const falt = w.document.getElementById('lonemanad');
        falt.value = '2026-10'; falt.dispatchEvent(new w.Event('change'));
        expect(w.__state.lonemanad).toBe('2026-10');
        w.__ritaFlik('matrix');
        expect(w.document.getElementById('aidbas-lika').textContent).toContain('Lönemånad: 2026-10');
        const cfg = w.eval('byggKonfiguration()');
        expect(cfg.lonemanad).toBe('2026-10');
        expect(cfg.likvardighet.kvDomDefinition).toBe('do');
        w.eval('tillampaKonfiguration(' + JSON.stringify({ ...cfg, lonemanad: '2025-11', likvardighet: { ...cfg.likvardighet, kvDomDefinition: 'scb' } }) + ')');
        expect(w.__state.lonemanad).toBe('2025-11');
        expect(w.__state.likvardighet.kvDomDefinition).toBe('scb');
        expect(() => w.eval('tillampaKonfiguration(' + JSON.stringify({ ...cfg, likvardighet: { kvDomDefinition: 'annat' } }) + ')')).toThrow(/kvDomDefinition/);
        // Jämförelseyrkena (ADR-60): standard alla som inte är kvinnodominerade; filtret följer med och valideras.
        expect(cfg.likvardighet.jamforelse).toBe('alla');
        w.eval('tillampaKonfiguration(' + JSON.stringify({ ...cfg, likvardighet: { ...cfg.likvardighet, jamforelse: 'mansdominerade' } }) + ')');
        expect(w.__state.likvardighet.jamforelse).toBe('mansdominerade');
        expect(w.eval('byggKonfiguration()').likvardighet.jamforelse).toBe('mansdominerade');
        expect(() => w.eval('tillampaKonfiguration(' + JSON.stringify({ ...cfg, likvardighet: { jamforelse: 'blandade' } }) + ')')).toThrow(/jamforelse/);
    });
    it('likvärdighetens fält i konfigurationsfilen: utan source, och talen prövas mot fältens gränser', () => {
        const w = fonster();
        const cfg = w.eval('byggKonfiguration()');
        expect(Object.keys(cfg.likvardighet)).not.toContain('source');
        // En äldre fil med fältet source läses in utan fel; fältet hoppas över.
        w.eval('tillampaKonfiguration(' + JSON.stringify({ ...cfg, likvardighet: { ...cfg.likvardighet, source: 'statistik' } }) + ')');
        expect(Object.keys(w.__state.likvardighet)).not.toContain('source');
        // Utanför gränserna: kvinnotröskeln 50–70, minsta skillnad 0–50, antal par minst 1. Inget ändras.
        const fel = lv => () => w.eval('tillampaKonfiguration(' + JSON.stringify({ ...cfg, likvardighet: { ...cfg.likvardighet, ...lv } }) + ')');
        expect(fel({ kvinnoTroskelPct: 80 })).toThrow(/kvinnoTroskelPct måste vara ett tal mellan 50 och 70/);
        expect(fel({ kvinnoTroskelPct: 45 })).toThrow(/kvinnoTroskelPct/);
        expect(fel({ minstaGapPct: -1 })).toThrow(/minstaGapPct måste vara ett tal mellan 0 och 50/);
        expect(fel({ minstaGapPct: 60 })).toThrow(/minstaGapPct/);
        expect(fel({ antalPar: 0 })).toThrow(/antalPar måste vara ett tal som är minst 1/);
        expect(w.__state.likvardighet.kvinnoTrosholdPct).toBe(60);
        // Visa alla sätter antalet par till hela listan, som kan vara fler än fältets 500; ett sparat sådant värde läses in.
        w.__state.likvardighet.topN = 750;
        const allaPar = w.eval('byggKonfiguration()');
        w.__state.likvardighet.topN = 20;
        w.eval('tillampaKonfiguration(' + JSON.stringify(allaPar) + ')');
        expect(w.__state.likvardighet.topN).toBe(750);
    });
});

describe('Likvärdigt arbete: avsnitten per BAS-intervall och den hierarkiska jämförelsen', () => {
    it('klassningen följer vald definition: exakt 60 % kvinnor är könsblandad med *Mer än 60 %* och kvinnodominerad med *60 % eller mer*', () => {
        const w = fonster();
        w.__ritaFlik('likvardighet');
        const t = tabell(w, 'aidbas-likvardigt-tabell');
        expect(t.rubriker).toEqual(['BAS-intervall', 'AID-kod', 'Etikettnamn', 'Antal', 'Andel kvinnor (%)', 'Andel kvinnor nationellt (%)', 'Klassning', 'Brukar anses kvinnodominerad', 'Medianlön', 'Lönespridning']);
        // Grundvyn gömmer de nationella kolumnerna och spridningen bakom Fler kolumner (F14); exporten har alla kolumner.
        expect(gomdaRubriker(w, 'aidbas-likvardigt-tabell')).toEqual(['Andel kvinnor nationellt (%)', 'Brukar anses kvinnodominerad', 'Lönespridning']);
        expect(w.__tabellTillMatris('aidbas-likvardigt-tabell')[0]).toEqual(t.rubriker);
        const b = () => tabell(w, 'aidbas-likvardigt-tabell').rader.find(r => r[1] === '3003');
        expect(b()[4]).toBe('60,0 %'); expect(b()[6]).toBe('Könsblandad'); expect(b()[8]).toBe('–');   // 5 personer: ingen median
        expect(w.document.getElementById('aidbas-likvardigt').textContent).toContain('Kvinnodominerad vid mer än 60 % kvinnor');
        const val = w.document.getElementById('lv-kv-definition');
        expect(val).not.toBeNull();
        expect(Array.from(val.options).map(o => `${o.value}: ${o.textContent}`)).toEqual(['do: Mer än 60 %', 'scb: 60 % eller mer']);   // ADR-72
        val.value = 'scb'; val.dispatchEvent(new w.Event('change'));
        expect(w.__state.likvardighet.kvDomDefinition).toBe('scb');
        expect(b()[6]).toBe('Kvinnodominerad');
        expect(w.document.getElementById('aidbas-likvardigt').textContent).toContain('Kvinnodominerad vid 60 % kvinnor eller mer');
        expect(w.document.getElementById('nyckel-lv-aidbas').textContent).toBe('4 grupper · 2 kvinnodominerade (60 % kvinnor eller mer)');   // skärmen visar också gruppen med 4 personer
        // Steg 1-raden, slutsatsen, Löneöversyn och beräkningsbeviset skriver gränsen med kvDomGransText(): samma lydelse
        // som valet och tabellerna, inte "minst".
        expect(w.eval('kvDomGransText()')).toBe('60 % kvinnor eller mer');
        val.value = 'do'; val.dispatchEvent(new w.Event('change'));
        expect(w.eval('kvDomGransText()')).toBe('mer än 60 % kvinnor');
    });
    it('rutan Jämför bara med mansdominerade AID-etiketter sätter filtret och ritar om (ADR-60)', () => {
        const w = fonster();
        w.__ritaFlik('likvardighet');
        const ruta = w.document.getElementById('lv-bara-mansdominerade');
        expect(ruta).not.toBeNull();
        expect(ruta.checked).toBe(false);
        ruta.checked = true; ruta.dispatchEvent(new w.Event('change'));
        expect(w.__state.likvardighet.jamforelse).toBe('mansdominerade');
        expect(w.document.getElementById('lv-bara-mansdominerade').checked).toBe(true);
        expect(w.document.getElementById('aidbas-likvardigt').textContent).toContain('bara de mansdominerade');
    });
    it('den hierarkiska jämförelsen listar paret, och texten om inga par när det inte finns något', () => {
        const w = fonster();
        w.__ritaFlik('likvardighet');
        const t = tabell(w, 'aidbas-hierarki-tabell');
        expect(t.rubriker).toEqual(['Grupp A (ej kvinnodominerad)', 'BAS A', 'Median A', 'Grupp B (kvinnodominerad)', 'BAS B', 'Median B', 'Skillnad (kr)', 'Skillnad (%)']);
        expect(t.rader).toEqual([['1001 Yrke 1001', 'A', '46 450 kr', '2002 Yrke 2002', 'E', '39 400 kr', '7 050 kr', '17,9 %']]);
        const w2 = fonster(TVA_BAS);
        w2.__ritaFlik('likvardighet');
        expect(tabell(w2, 'aidbas-hierarki-tabell')).toBeNull();
        expect(w2.document.getElementById('aidbas-hierarki').textContent).toContain('Inga fall där ett arbete med lägre krav, som inte är kvinnodominerat, har högre lön än ett kvinnodominerat arbete med högre krav.');
    });
    it('diagnostiken räknar kvinnodominerade AID-etiketter som jämfördes med statistiken, inte BAS-intervall', () => {
        // Två kvinnodominerade AID-etiketter i samma BAS-intervall utan AID-etikett att jämföra med i organisationen: två etiketter, ett intervall.
        const w = fonster([...grupp('E', '2002', 'kvinna', 30, 38000), ...grupp('E', '2002', 'man', 9, 39000),
            ...grupp('E', '4004', 'kvinna', 12, 37000), ...grupp('E', '4004', 'man', 2, 37500)]);
        w.__state.statistik = [{ aid: '6100', bas: 'E', median: 45000, andelKv: 20, aidFull: '6100 Jämförelseyrke' }];
        w.__state.statistikHasKon = true;
        w.__ritaFlik('likvardighet');
        const text = w.document.getElementById('likvardighet-content').textContent.replace(/\s+/g, ' ');
        expect(text).toContain('2 kvinnodominerade AID-etiketter (i ett BAS-intervall) hade ingen AID-etikett att jämföra med i organisationen och jämfördes i stället med jämförelsestatistiken');
        expect(text).not.toMatch(/BAS saknade/);
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
        expect(lika[rubrik]).toEqual(['BAS-intervall', 'AID-kod', 'Etikettnamn', 'Antal kvinnor', 'Antal män', 'Medianlön kvinnor', 'Medianlön män', 'Kvinnors median i % av mäns', 'Nedre gräns', 'Övre gräns', 'Status', 'Ojusterad löneskillnad ≥ 5 %']);
        const rader = lika.slice(rubrik + 1).filter(r => r.length === 12);
        // Exporten har tabellens grupper vid tröskeln 10: 1001 i C (4 personer) och 3003 i B (5) namnges i noten utan
        // antal, 1001 i A (en kvinna) räknas bland dem som inte jämförs.
        expect(rader.map(r => `${r[0]} ${r[1]}`)).toEqual(['D 7007', 'E 2002', 'F 7007']);
        const not = lika.find(r => /visas inte/.test(String(r[0])))[0];
        expect(not).toBe('2 grupper visas inte: 1001 Yrke 1001 (BAS C), 3003 Yrke 3003 (BAS B). De har färre än 10 personer, och deras lönemått skulle kunna peka ut enskilda. 1 grupp har färre än två kvinnor eller två män och jämförs inte.');
        const summa = rader.reduce((s, r) => s + r[3] + r[4], 0) + 4 + 5 + 10;
        expect(summa).toBe(UNDERLAG.length + TVA_BAS.length);
        // Inga medianer för ett kön under 10: raden för 2002 har tomma celler och tabellens status.
        const e = rader.find(r => r[1] === '2002');
        expect(e.slice(5)).toEqual(['', '', '', '', '', 'Könsuppdelningen är för liten (ett kön n < 10)', '']);
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
        expect(lv.find(r => r[0] === 'BAS-intervall')).toEqual(['BAS-intervall', 'AID-kod', 'Etikettnamn', 'Antal', 'Andel kvinnor (%)', 'Andel kvinnor nationellt (%)', 'Klassning', 'Brukar anses kvinnodominerad', 'Medianlön', 'Lönespridning']);
        expect(lv.some(r => r[0] === 'Sammanfattning per BAS-intervall: högsta och lägsta medianlön bland kvinnodominerade grupper och bland övriga; skillnaden är högsta median övriga mot högsta kvinnodominerad.')).toBe(true);
        expect(lv.filter(r => r.length === 10 && r[0] !== 'BAS-intervall').map(r => `${r[0]} ${r[1]}`)).toEqual(['A 1001', 'B 3003', 'D 7007', 'E 2002', 'F 7007']);
        const par = blad('Hierarkisk jämförelse');
        expect(par.find(r => r[0] === 'Grupp A (ej kvinnodominerad)')).toEqual(['Grupp A (ej kvinnodominerad)', 'BAS A', 'Median A', 'Grupp B (kvinnodominerad)', 'BAS B', 'Median B', 'Skillnad (kr)', 'Skillnad (%)']);
        expect(par.some(r => r[0] === '1001 Yrke 1001' && r[1] === 'A' && r[2] === 46450 && r[3] === '2002 Yrke 2002' && r[6] === 7050)).toBe(true);
        const ind = blad('Analys på individnivå');
        expect(ind.find(r => r[0] === 'BAS-intervall')).toEqual(['BAS-intervall', 'AID-kod', 'Etikettnamn', 'Antal kvinnor', 'Antal män', 'Analys genomförd', 'Resultat']);
        expect(ind.filter(r => r.length >= 5 && r[0] !== 'BAS-intervall').map(r => `${r[0]} ${r[1]}`)).toEqual(['A 1001', 'B 3003', 'E 2002']);
        expect(JSON.stringify(ind)).not.toMatch(/\b(3\d|4\d)\d{3}\b/);   // inga löner
        // Metodik beskriver tabellerna, gränserna och definitionen.
        const met = blad('Metodik').flat().join('\n');
        expect(met).toContain('Tabellerna per AID-kod och BAS-intervall');
        expect(met).toContain('Gränser för slumpen (statusen i Lika arbete, Slumpens gränser)');
        expect(met).toContain('Kvinnodominerad vid mer än 60 % kvinnor');
        expect(w.eval('_excelAlltBok()').Sheets['Metod & parametrar']).toBeDefined();
    });
    it('utan par står texten om inga fall i bladet Hierarkisk jämförelse', async () => {
        const w = fonster(TVA_BAS);
        const { blad } = await bok(w);
        expect(blad('Hierarkisk jämförelse').flat()).toContain('Inga fall där ett arbete med lägre krav, som inte är kvinnodominerat, har högre lön än ett kvinnodominerat arbete med högre krav.');
    });
});

describe('Slumpens gränser räknar per AID-kod och BAS-intervall', () => {
    it('en yrkesgrupp i två intervall får två rader med sitt eget intervall och sina egna antal', async () => {
        const w = fonster([...UNDERLAG, ...TVA_BAS]);
        const { blad } = await bok(w);
        const s = blad('Slumpens gränser');
        const rader = s.filter(r => r[0] === '7007 Yrke 7007');
        expect(rader.map(r => [r[1], r[2], r[3]])).toEqual([['D', 12, 12], ['F', 12, 12]]);
        expect(s.some(r => r[0] === '1001 Yrke 1001')).toBe(false);   // inget intervall har 10 av varje kön
        // Trattens underlag på skärmen: samma nyckel.
        w.__ritaFlik('matrix');
        const u = w.eval('_laTrattUnderlag(hamtaData(), 10)');
        expect(u.punkter.map(p => p.nyckel).sort()).toEqual(['7007|D', '7007|F']);
    });
});

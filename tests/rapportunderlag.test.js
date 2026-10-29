import { describe, it, expect } from 'vitest';
import { likaArbeteGrupper, justeratGapInomYrke, gruppBlock, parBlock, avsnittBlock, tillWordHtml, tillText,
    formatTal, FRAGOR_YRKE, FRAGOR_PAR, stabilitetKort } from '../src/lib/rapportunderlag.js';
import { mulberry32 } from '../src/lib/rng.js';
import { gapUppdelning } from '../src/lib/gapuppdelning.js';

const K = 10;
const person = (yrke, kon, lon, alder = 40, bas = 'C') => ({ yrke, kon, lon, alder, bas });
const grupp = (yrke, nKv, lonKv, nMa, lonMa) => [
    ...Array.from({ length: nKv }, () => person(yrke, 'kvinna', lonKv)),
    ...Array.from({ length: nMa }, () => person(yrke, 'man', lonMa)),
];

describe('likaArbeteGrupper', () => {
    it('flaggar skillnad över 5 %, inte exakt 5 %', () => {
        const r = [...grupp('A', 10, 95000, 10, 100000), ...grupp('B', 10, 94990, 10, 100000)];
        const { grupper } = likaArbeteGrupper(r, { k: K });
        const a = grupper.find(g => g.yrke === 'A'), b = grupper.find(g => g.yrke === 'B');
        expect(a.gapPct).toBeCloseTo(5, 10);
        expect(a.flaggad).toBe(false);
        expect(b.flaggad).toBe(true);
        expect(b.kvot).toBeCloseTo(0.9499, 10);
    });
    it('samlad median när ett kön har färre än k — inga könsvärden', () => {
        const { grupper } = likaArbeteGrupper(grupp('C', 10, 30000, 9, 40000), { k: K });
        const c = grupper[0];
        expect(c.samladMedian).toBe(true);
        expect(c.flaggad).toBe(false);
        expect(c.medKv).toBeUndefined();
        expect(c.medMa).toBeUndefined();
        expect(c.medTot).toBe(30000);
    });
    it('utelämnar yrket när ett kön är under k och hela gruppen under k', () => {
        const res = likaArbeteGrupper(grupp('D', 5, 30000, 4, 40000), { k: K });
        expect(res.grupper).toEqual([]);
        expect(res.utelamnade).toEqual(['D']);
    });
    it('yrken med färre än 2 av ett kön är inte jämförbara', () => {
        const res = likaArbeteGrupper(grupp('E', 30, 30000, 1, 40000), { k: K });
        expect(res.grupper).toEqual([]);
        expect(res.ejJamforbara).toEqual(['E']);
    });
    it('sorterar fallande på gap och ger percentiler per kön', () => {
        const r = [...grupp('Liten', 10, 99000, 10, 100000), ...grupp('Stor', 10, 80000, 10, 100000)];
        const { grupper } = likaArbeteGrupper(r, { k: K });
        expect(grupper.map(g => g.yrke)).toEqual(['Stor', 'Liten']);
        expect(grupper[0].p10Kv).toBe(80000);
        expect(grupper[0].p90Ma).toBe(100000);
    });
});

describe('justeratGapInomYrke', () => {
    it('ålder som förklarar hela gapet ger justerat gap nära 0', () => {
        const r = [];
        for (let i = 0; i < 20; i++) {
            const alder = 25 + i * 2;
            r.push(person('X', 'kvinna', 30000 * Math.exp(0.01 * (alder - 25)), alder));
            r.push(person('X', 'man', 30000 * Math.exp(0.01 * (alder + 10 - 25)), alder + 10));
        }
        const res = justeratGapInomYrke(r, { k: K });
        expect(res.forFa).toBeUndefined();
        expect(Math.abs(res.gapPct)).toBeLessThan(0.5);
        expect(res.n).toBe(40);
    });
    it('ett gap som består efter ålder syns i justeringen', () => {
        const r = [];
        for (let i = 0; i < 20; i++) {
            const alder = 25 + i * 2;
            r.push(person('X', 'kvinna', 27000 * Math.exp(0.01 * (alder - 25)), alder));
            r.push(person('X', 'man', 30000 * Math.exp(0.01 * (alder - 25)), alder));
        }
        expect(justeratGapInomYrke(r, { k: K }).gapPct).toBeCloseTo(-10, 5);
    });
    it('för få personer av ett kön ger forFa', () => {
        expect(justeratGapInomYrke(grupp('Y', 9, 30000, 20, 31000), { k: K })).toEqual({ forFa: true });
    });
    it('BAS-dummies används när yrket finns i flera BAS', () => {
        const r = [];
        for (let i = 0; i < 12; i++) {
            r.push(person('Z', 'kvinna', 28000 + i * 10, 30 + i, 'C'));
            r.push(person('Z', 'man', 36000 + i * 10, 30 + i, 'D'));
            r.push(person('Z', 'kvinna', 36000 + i * 10, 30 + i, 'D'));
            r.push(person('Z', 'man', 28000 + i * 10, 30 + i, 'C'));
        }
        // Inom varje BAS är lönerna lika för kvinnor och män → justerat gap ≈ 0.
        expect(Math.abs(justeratGapInomYrke(r, { k: K }).gapPct)).toBeLessThan(0.01);
    });
});

const norm = t => t.replace(/\u00a0/g, ' ').replace(/\u2212/g, '-');
const yrkesgrupp = {
    yrke: 'Undersköterska', nKv: 62, nMa: 22, tot: 84, samladMedian: false, medKv: 28830, medMa: 30000,
    kvot: 0.961, gapPct: 3.9, flaggad: true, p10Kv: 26000, p90Kv: 31000, p10Ma: 27000, p90Ma: 33500
};

describe('formatTal', () => {
    it('svenskt format: decimalkomma och mellanslag', () => {
        expect(norm(formatTal(96.1, 1))).toBe('96,1');
        expect(norm(formatTal(28830, 0))).toBe('28 830');
        expect(norm(formatTal(-2.84, 1))).toBe('-2,8');
    });
});

describe('gruppBlock', () => {
    const b = gruppBlock(yrkesgrupp, { id: 'yrke:0', justerat: { gapPct: -2.8, n: 84 }, ki: { lo: 93.0, hi: 98.9 }, urval: 'Hela organisationen' });
    it('faktastycket har siffrorna med decimalkomma', () => {
        const t = norm(b.stycken.join(' '));
        expect(t).toContain('Inom Undersköterska (n = 84, varav 62 kvinnor och 22 män)');
        expect(t).toContain('96,1 % av männens');
        expect(t).toContain('95 % KI 93,0–98,9');
        expect(t).toContain('Efter hänsyn till ålder och BAS inom yrket återstår en skillnad på -2,8 %');
        expect(t).toContain('Urval: Hela organisationen');
    });
    it('tabell per kön, prövat och frågor', () => {
        expect(b.tabell.rubriker).toEqual(['', 'Antal', 'P10', 'Median', 'P90']);
        expect(norm(b.tabell.rader[0].join('|'))).toBe('Kvinnor|62|26 000 kr|28 830 kr|31 000 kr');
        expect(b.provat.length).toBe(1);
        expect(b.fragor).toEqual(FRAGOR_YRKE);
        expect(FRAGOR_YRKE.length).toBe(6);
    });
    it('för få personer för att justera', () => {
        const b2 = gruppBlock(yrkesgrupp, { id: 'yrke:0', justerat: { forFa: true } });
        expect(b2.provat[0]).toBe('För få personer för att justera för ålder och BAS.');
        expect(b2.stycken.join(' ')).not.toContain('Efter hänsyn');
    });
    it('demoläge ger en DEMODATA-rad först', () => {
        const b3 = gruppBlock(yrkesgrupp, { id: 'yrke:0', justerat: { forFa: true }, demo: true });
        expect(b3.stycken[0]).toBe('DEMODATA — inte verkliga löner.');
    });
});

describe('parBlock', () => {
    const par = { kvLabel: 'Förskollärare', kvBas: 'D', kvN: 40, kvKvinnoPct: 91, kvMedian: 36400,
        maLabel: 'Ingenjör', maBas: 'D', maN: 20, maKvAndel: 15, maMedian: 38000,
        gapKr: 1600, gapPct: 1600 / 36400 * 100, gapCI: { lo: 400, hi: 2550 }, jamforKalla: 'intern' };
    it('faktastycke, krav-proxy och frågor', () => {
        const b = parBlock(par, { id: 'par:0', kravProxy: 'bas' });
        expect(b.rubrik).toBe('Förskollärare — Ingenjör');
        const t = norm(b.stycken.join(' '));
        expect(t).toContain('Förskollärare (BAS D, 91 % kvinnor, median 36 400 kr) har 1 600 kr lägre medianlön än Ingenjör (BAS D, median 38 000 kr)');
        expect(t).toContain('Jämförelseyrkets median ligger 4,4 % högre (95 % KI 1,1–7,0 %)');
        expect(t).toContain('BAS-intervall som mått på krav');
        expect(b.fragor).toEqual(FRAGOR_PAR);
        expect(FRAGOR_PAR.length).toBe(4);
    });
    it('poäng som krav-proxy', () => {
        expect(parBlock(par, { id: 'par:0', kravProxy: 'poäng' }).stycken.join(' ')).toContain('arbetsvärderingspoäng');
    });
});

describe('avsnittBlock', () => {
    it('lika arbete: räknar flaggade, samlade och utelämnade, tabell över flaggade', () => {
        const grupper = [yrkesgrupp, { ...yrkesgrupp, yrke: 'Kock', flaggad: false, gapPct: 2 },
            { yrke: 'Vaktmästare', nKv: 3, nMa: 12, tot: 15, samladMedian: true, flaggad: false, gapPct: 0, medTot: 30000 }];
        const b = avsnittBlock('lika', { grupper, utelamnade: ['Tandläkare'] }, { k: 10 });
        const t = norm(b.stycken.join(' '));
        expect(t).toContain('4 yrkesgrupper');
        expect(t).toContain('1 har en skillnad över 5 %');
        expect(t).toContain('1 redovisas med samlad median');
        expect(t).toContain('1 utelämnas');
        expect(b.tabell.rader.length).toBe(1);
        expect(b.tabell.rader[0][0]).toBe('Undersköterska');
    });
    it('lika arbete utan flaggade yrken', () => {
        const b = avsnittBlock('lika', { grupper: [], utelamnade: [] }, { k: 10 });
        expect(b.stycken.join(' ')).toContain('Ingen yrkesgrupp har en skillnad över 5 %');
        expect(b.tabell).toBeNull();
    });
    it('struktur utelämnar BAS under k och maskerar gap när ett kön är under k', () => {
        const b = avsnittBlock('struktur', { representation: [
            { bas: 'A', n: 30, nKv: 20, nMa: 10, andelKv: 66.7, median: 30000, gapPct: -2 },
            { bas: 'B', n: 8, nKv: 5, nMa: 3, andelKv: 62.5, median: 31111, gapPct: -9 },
            { bas: 'C', n: 25, nKv: 20, nMa: 5, andelKv: 80, median: 33333, gapPct: -7 }
        ], kvartiler: [] }, { k: 10 });
        const t = b.tabell.rader.map(r => norm(r.join('|')));
        expect(t[0]).toBe('A|30|66,7 %|30 000 kr|-2,0 %');
        expect(t[1]).toBe('C|25|80,0 %|33 333 kr|–');   // B (n = 8) utelämnas helt
        expect(t.length).toBe(2);
    });
    it('sammanfattning med oförklarat gap och kvalitet', () => {
        const b = avsnittBlock('sammanfattning', { n: 200, nKv: 100, nMa: 100, medKv: 36000, medMa: 40000,
            oforklarat: { pct: -2.44, lo: -3.5, hi: -1.4 }, kvalitet: { status: 'varning', brister: ['Jämförbarhet'] } }, {});
        const t = norm(b.stycken.join(' '));
        expect(t).toContain('200 anställda, varav 100 kvinnor och 100 män');
        expect(t).toContain('90,0 % av männens');
        expect(t).toContain('-2,4 % (95 % KI -3,5 till -1,4 %)');
        expect(t).toContain('Varning');
    });
});

describe('tillWordHtml och tillText', () => {
    const b = gruppBlock({ ...yrkesgrupp, yrke: 'R&D <chef> "x"' }, { id: 'yrke:0', justerat: { forFa: true } });
    it('ren HTML utan format och med kodade tecken', () => {
        const h = tillWordHtml(b);
        expect(h).toMatch(/^<h3>/);
        expect(h).not.toMatch(/style=|<font|color|class=/i);
        expect(h).toContain('R&amp;D &lt;chef&gt; &quot;x&quot;');
        expect(h).not.toContain('<chef>');
        expect(h).toContain('<table border="1"');
        expect(h).toContain('<ol>');
    });
    it('text med tabbar mellan kolumner och numrerade frågor', () => {
        const t = tillText(b);
        expect(t.split('\n')[0]).toBe('R&D <chef> "x"');
        expect(t).toContain('\tAntal\tP10\tMedian\tP90');
        expect(t).toContain('1. ' + FRAGOR_YRKE[0]);
    });
});

describe('rapportunderlag: små kön, modeller och texter', () => {
    it('sammanfattningen visar inga könsuppdelade lönemått när ett kön är under k', () => {
        const b = avsnittBlock('sammanfattning', { n: 15, nKv: 12, nMa: 3, medKv: 30000, medMa: 77777,
            oforklarat: { pct: -3, lo: -5, hi: -1, medBas: true }, kvalitet: null }, { k: 10 });
        const allt = norm(tillText(b));
        expect(allt).not.toContain('77 777');
        expect(allt).not.toContain('30 000');
        expect(allt).not.toMatch(/oförklarade/i);
        expect(allt).toContain('färre än 10');
        expect(allt).toContain('15 anställda');
    });
    it('strukturens kvartilrad utelämnas när ett kön i urvalet är under k', () => {
        const b = avsnittBlock('struktur', { representation: [], kvartiler: [{ q: 4, andelKv: 0 }], nKv: 12, nMa: 3 }, { k: 10 });
        expect(tillText(b)).not.toMatch(/kvartil/);
    });
    it('modell utan BAS formuleras som bara ålder', () => {
        const b = avsnittBlock('sammanfattning', { n: 200, nKv: 100, nMa: 100, medKv: 36000, medMa: 40000,
            oforklarat: { pct: -2, lo: -3, hi: -1, medBas: false }, kvalitet: null }, { k: 10 });
        const t = norm(tillText(b));
        expect(t).not.toContain('ålder och BAS');
        expect(t).toContain('Efter hänsyn till ålder');
        expect(t).toContain('BAS-intervall kunde inte tas med');
    });
    it('skillnad som byter tecken efter justering beskrivs som det', () => {
        const b = gruppBlock({ ...yrkesgrupp, kvot: 0.92 }, { id: 'yrke:0', justerat: { gapPct: 3, n: 84 } });
        expect(b.provat[0]).not.toContain('förklarar 5');
        expect(b.provat[0]).toContain('byter skillnaden tecken');
    });
});

describe('rapportunderlag: struktur, likvärdighet och singular', () => {
    it('strukturblocket utelämnar BAS under k och säger hur många', () => {
        const b = avsnittBlock('struktur', { representation: [
            { bas: 'A', n: 30, nKv: 20, nMa: 10, andelKv: 66.7, median: 30000, gapPct: -2 },
            { bas: 'B', n: 8, nKv: 5, nMa: 3, andelKv: 62.5, median: 31111, gapPct: -9 }], kvartiler: [], nKv: 25, nMa: 13 }, { k: 10 });
        expect(b.tabell.rader.map(r => r[0])).toEqual(['A']);
        expect(b.stycken.join(' ')).toContain('1 BAS-intervall med färre än 10 personer redovisas inte');
    });
    it('likvärdighetstabellen har KI och texten nämner kvinnotröskeln', () => {
        const par = [{ kvLabel: 'F', kvBas: 'C', kvMedian: 36400, maLabel: 'I', maBas: 'C', gapKr: 1600, gapPct: 4.4, gapCI: { lo: 400, hi: 2550 } }];
        const b = avsnittBlock('likvardigt', { par, exkluderade: 0, kravProxy: 'bas', kvinnoTroskel: 60 }, { k: 10 });
        expect(b.tabell.rubriker).toContain('95 % KI');
        expect(norm(b.tabell.rader[0].join('|'))).toContain('1,1–7,0 %');
        expect(b.stycken.join(' ')).toContain('minst 60 % kvinnor');
    });
    it('kön och BAS som sammanfaller inom yrket ger ett eget besked', () => {
        const r = [];
        for (let i = 0; i < 12; i++) {
            r.push({ yrke: 'Z', kon: 'kvinna', lon: 30000 + i, alder: 30 + i, bas: 'C' });
            r.push({ yrke: 'Z', kon: 'man', lon: 36000 + i, alder: 30 + i, bas: 'D' });
        }
        const j = justeratGapInomYrke(r, { k: 10 });
        expect(j).toEqual({ ejSkattbar: true });
        const b = gruppBlock(yrkesgrupp, { id: 'yrke:0', justerat: j });
        expect(b.provat[0]).toContain('kön och BAS sammanfaller');
    });
    it('singular i texterna', () => {
        const lika = avsnittBlock('lika', { grupper: [], utelamnade: ['X'] }, { k: 10 });
        expect(lika.stycken.join(' ')).toContain('1 yrkesgrupp jämfördes');
        const hp = avsnittBlock('handlingsplan', { rader: [{ atgard: 'a', grupp: 'g', underlag: 'u', kostnad: 1000 }], summa: 1000 }, { k: 10 });
        expect(hp.stycken.join(' ')).toContain('1 förifylld åtgärd');
        const s = avsnittBlock('sammanfattning', { n: 20, nKv: 10, nMa: 10, medKv: 1, medMa: 1 }, { k: 10 });
        expect(s.stycken.join(' ')).toContain('20 anställda');
    });
});

describe('avsnittBlock uppdelning', () => {
    const flera = (n, kon, lon, bas, aid) => Array.from({ length: n }, () => ({ kon, lon, bas, aid, alder: 40 }));
    const data = [...flera(30, 'kvinna', 30000, 'A', 'A1'), ...flera(10, 'man', 30000, 'A', 'A1'),
                  ...flera(10, 'kvinna', 41000, 'B', 'B1'), ...flera(30, 'man', 42000, 'B', 'B1')];
    it('faktastycke med belopp per del och tabell med fyra rader', () => {
        const u = gapUppdelning(data, { k: 10 });
        const b = avsnittBlock('uppdelning', u, { k: 10, urval: 'Hela organisationen' });
        expect(b.id).toBe('uppdelning');
        expect(b.rubrik).toBe('Var uppstår löneskillnaden?');
        const text = b.stycken.join(' ');
        expect(text).toContain(`${formatTal(u.delar.A, 0)} kr på att kvinnor och män är olika fördelade över BAS`);
        expect(text).toContain('Urval: Hela organisationen.');
        expect(b.tabell.rubriker).toEqual(['Del', 'Bidrag (kr)', 'Andel av skillnaden', 'Störst bidrag']);
        expect(b.tabell.rader.map(r => r[0])).toEqual(['BAS-fördelning', 'AID inom BAS', 'Inom AID och BAS', 'Totalt']);
        expect(b.tabell.rader[3][2]).toBe('100 %');
        expect(b.tabell.rader[0][3]).toContain('BAS B');
    });
    it('litet gap: andelar visas som "—" och en förklarande mening', () => {
        const u = gapUppdelning([...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(20, 'man', 30200, 'A', 'A1')], { k: 10 });
        const b = avsnittBlock('uppdelning', u, { k: 10 });
        expect(b.tabell.rader.every(r => r[2] === '—')).toBe(true);
        expect(b.stycken.join(' ')).toContain('mindre än 1 %');
    });
    it('reserven: inga delar när en liten grupp annars kan räknas fram — bara hela skillnaden', () => {
        const u = gapUppdelning([...flera(20, 'kvinna', 30000, 'A', 'A1'), ...flera(20, 'man', 31000, 'A', 'A1'),
            ...flera(5, 'kvinna', 50000, 'B', 'B1'), ...flera(3, 'man', 60000, 'B', 'B1')], { k: 10 });
        expect(u.skyddad).toBe(false);
        const b = avsnittBlock('uppdelning', u, { k: 10 });
        expect(b.tabell).toBeNull();
        const text = b.stycken.join(' ');
        expect(text).toContain(`en skillnad på ${formatTal(u.gap, 0)} kr`);
        expect(text).toMatch(/delas inte upp/);
    });
    it('Störst bidrag visar samma poster som kortet (hela den skyddade listan)', () => {
        const u = gapUppdelning(data, { k: 10 });
        const b = avsnittBlock('uppdelning', u, { k: 10 });
        expect(b.tabell.rader[0][3].split('; ').length).toBe(u.topp.A.length || 1);
    });
    it('null: "för få personer" utan tabell', () => {
        const b = avsnittBlock('uppdelning', null, { k: 10, demo: true });
        expect(b.stycken[0]).toBe('DEMODATA — inte verkliga löner.');
        expect(b.stycken.join(' ')).toContain('För få personer för att dela upp skillnaden');
        expect(b.tabell).toBeNull();
    });
});

describe('stabilitet för flaggor', () => {
    const K = 10;
    const yrke = (kv, ma) => [...kv.map(lon => ({ yrke: 'Y', kon: 'kvinna', lon })), ...ma.map(lon => ({ yrke: 'Y', kon: 'man', lon }))];
    const rep = (n, v) => Array(n).fill(v);
    const st = rader => likaArbeteGrupper(rader, { k: K }).grupper[0].stabilitet;
    const gap = (kv, ma) => { const m = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
        return Math.abs(m(kv) / m(ma) * 100 - 100); };
    const brute = (kv, ma) => {
        const utan = (a, idx) => a.filter((_, i) => !idx.includes(i));
        let min1 = Infinity, min2 = Infinity;
        const prova = (a, b, m) => { if (a.length < K || b.length < K) return; const g = gap(a, b); if (m === 1) min1 = Math.min(min1, g); else min2 = Math.min(min2, g); };
        for (let i = 0; i < kv.length; i++) prova(utan(kv, [i]), ma, 1);
        for (let i = 0; i < ma.length; i++) prova(kv, utan(ma, [i]), 1);
        for (let i = 0; i < kv.length; i++) for (let j = i + 1; j < kv.length; j++) prova(utan(kv, [i, j]), ma, 2);
        for (let i = 0; i < ma.length; i++) for (let j = i + 1; j < ma.length; j++) prova(kv, utan(ma, [i, j]), 2);
        for (let i = 0; i < kv.length; i++) for (let j = 0; j < ma.length; j++) prova(utan(kv, [i]), utan(ma, [j]), 2);
        return { min1, min2 };
    };

    it('skör med 1 person när bara borttagning av medianvärdet räcker (ytterfallen skjuter över)', () => {
        const s = st(yrke([...rep(5, 90000), 94900, ...rep(5, 118000)], rep(12, 100000)));
        expect(s.niva).toBe('skor1');
        expect(s.lagstaGapPct).toBeCloseTo(4, 9);
        expect(s.begransad).toBeNull();
    });
    it('skör med 2 personer', () => {
        const s = st(yrke([...rep(5, 80000), 94000, 94500, ...rep(5, 100000)], rep(12, 100000)));
        expect(s.niva).toBe('skor2');
        expect(s.lagstaGapPct).toBeLessThanOrEqual(5);
    });
    it('stabil', () => {
        const s = st(yrke(rep(12, 90000), rep(12, 100000)));
        expect(s).toEqual({ niva: 'stabil', lagstaGapPct: 10, begransad: null, provadeMax: 2 });
    });
    it('kvinnor högre lön: samma beräkning, absolut skillnad', () => {
        expect(st(yrke(rep(12, 110000), rep(12, 100000))).niva).toBe('stabil');
    });
    it('begränsad: ett kön med exakt k, båda med exakt k', () => {
        expect(st(yrke(rep(10, 90000), rep(12, 100000))).begransad).toBe('kvinnor');
        expect(st(yrke(rep(12, 90000), rep(10, 100000))).begransad).toBe('man');
        expect(st(yrke(rep(10, 90000), rep(10, 100000)))).toEqual({ niva: 'stabil', lagstaGapPct: null, begransad: 'bada', provadeMax: 0 });
    });
    it('k och k+1: bara en borttagning kunde prövas — texten påstår inte två', () => {
        const s = st(yrke(rep(11, 90000), rep(10, 100000)));
        expect(s).toMatchObject({ niva: 'stabil', begransad: 'man', provadeMax: 1 });
        expect(stabilitetKort(s, K)).toBe('Stabil: över 5 % även utan 1 person, fler kunde inte prövas (prövat bara på kvinnor)');
        const g = likaArbeteGrupper(yrke(rep(11, 90000), rep(10, 100000)), { k: K }).grupper[0];
        expect(gruppBlock(g, { id: 'yrke:0', k: K }).provat.at(-1)).toBe('Känslighet: skillnaden ligger kvar över 5 % även om en person tas bort; fler kunde inte prövas (prövat bara på kvinnor).');
    });
    it('ej flaggade grupper saknar stabilitet', () => {
        expect(likaArbeteGrupper(yrke(rep(12, 98000), rep(12, 100000)), { k: K }).grupper[0].stabilitet).toBeUndefined();
    });
    it('exakt: samma nivå och lägsta skillnad som uttömmande prövning (200 slumpade grupper)', () => {
        const rnd = mulberry32(2026);
        let provade = 0;
        for (let t = 0; t < 200; t++) {
            const nKv = 10 + Math.floor(rnd() * 9), nMa = 10 + Math.floor(rnd() * 9);
            const kv = Array.from({ length: nKv }, () => 26000 + Math.round(rnd() * 12) * 1000);
            const ma = Array.from({ length: nMa }, () => 28000 + Math.round(rnd() * 12) * 1000);
            const g = likaArbeteGrupper(yrke(kv, ma), { k: K }).grupper[0];
            if (!g.flaggad) continue;
            provade++;
            const b = brute(kv, ma);
            const vantadNiva = b.min1 <= 5 ? 'skor1' : b.min2 <= 5 ? 'skor2' : 'stabil';
            expect(g.stabilitet.niva, `grupp ${t}`).toBe(vantadNiva);
            const vantadLagst = vantadNiva === 'skor1' ? b.min1 : (Number.isFinite(b.min2) ? b.min2 : b.min1);
            expect(g.stabilitet.lagstaGapPct, `grupp ${t}`).toBeCloseTo(vantadLagst, 9);
        }
        expect(provade).toBeGreaterThan(50);
    });
    it('exakt även för större grupper, kontinuerliga löner och många lika löner (n upp till 40)', () => {
        const rnd = mulberry32(4040);
        let provade = 0;
        for (let t = 0; t < 120; t++) {
            const nKv = 10 + Math.floor(rnd() * 31), nMa = 10 + Math.floor(rnd() * 31);
            const lika = t % 3 === 0;   // var tredje grupp: löner på ett grovt rutnät med många lika värden
            const lon = bas => lika ? bas + Math.round(rnd() * 3) * 2000 : bas + rnd() * 12000;
            const kv = Array.from({ length: nKv }, () => lon(26000));
            const ma = Array.from({ length: nMa }, () => lon(28000));
            const g = likaArbeteGrupper(yrke(kv, ma), { k: K }).grupper[0];
            if (!g.flaggad) continue;
            provade++;
            const b = brute(kv, ma);
            const vantadNiva = b.min1 <= 5 ? 'skor1' : b.min2 <= 5 ? 'skor2' : 'stabil';
            expect(g.stabilitet.niva, `grupp ${t}`).toBe(vantadNiva);
            const vantadLagst = vantadNiva === 'skor1' ? b.min1 : (Number.isFinite(b.min2) ? b.min2 : b.min1);
            expect(g.stabilitet.lagstaGapPct, `grupp ${t}`).toBeCloseTo(vantadLagst, 9);
        }
        expect(provade).toBeGreaterThan(30);
    });
    it('stabilitetKort', () => {
        expect(stabilitetKort({ niva: 'skor1', lagstaGapPct: 4.61, begransad: null }, K)).toBe('Skör: kan bli 4,6 % om 1 person tas bort');
        expect(stabilitetKort({ niva: 'skor2', lagstaGapPct: 3, begransad: 'kvinnor' }, K)).toBe('Skör: kan bli 3,0 % om 2 personer tas bort (prövat bara på män)');
        expect(stabilitetKort({ niva: 'stabil', lagstaGapPct: 8, begransad: 'man' }, K)).toBe('Stabil: över 5 % även utan 2 personer (prövat bara på kvinnor)');
        expect(stabilitetKort({ niva: 'stabil', lagstaGapPct: null, begransad: 'bada' }, K)).toBe('Kan inte prövas: båda könen har exakt 10 personer');
    });
    it('gruppBlock: känslighetsraden sist i provat', () => {
        const g = likaArbeteGrupper(yrke(rep(12, 90000), rep(12, 100000)), { k: K }).grupper[0];
        const b = gruppBlock(g, { id: 'yrke:0', k: K });
        expect(b.provat.at(-1)).toBe('Känslighet: skillnaden ligger kvar över 5 % även om två personer tas bort.');
        const g1 = likaArbeteGrupper(yrke([...rep(5, 90000), 94900, ...rep(5, 118000)], rep(12, 100000)), { k: K }).grupper[0];
        expect(gruppBlock(g1, { id: 'yrke:0', k: K }).provat.at(-1)).toBe('Känslighet: skillnaden kan sjunka till 4,0 % om en person tas bort.');
    });
});

describe('avsnittBlock lagreKrav', () => {
    const par = { kvLabel: 'Barnskötare', kvBas: 'E', maLabel: 'Drifttekniker', maBas: 'C', basSteg: 2,
        kvMedian: 30000, maMedian: 34000, gapKr: 4000, gapPct: 13.33, gapCI: { lo: 3000, hi: 5000 } };
    it('faktastycke, tabell och frågor', () => {
        const b = avsnittBlock('lagreKrav', { par: [par], exkluderade: 2, kravProxy: 'bas' }, { k: 10, urval: 'Hela organisationen' });
        expect(b.id).toBe('lagreKrav');
        expect(b.rubrik).toBe('Lägre krav, högre lön');
        expect(b.stycken.join(' ')).toContain('1 par där ett kvinnodominerat yrke har lägre medianlön än ett av organisationens yrken i lägre BAS');
        expect(b.stycken.join(' ')).toContain('2 par med en grupp under 10 personer redovisas inte här.');
        expect(b.tabell.rubriker).toEqual(['Kvinnodominerat yrke', 'Jämförelseyrke', 'BAS-steg', 'Skillnad (kr)', 'Skillnad (%)', '95 % KI']);
        expect(b.tabell.rader[0].slice(0, 3)).toEqual(['Barnskötare (BAS E)', 'Drifttekniker (BAS C)', '2']);
        expect(b.fragor).toEqual([...FRAGOR_PAR]);
        expect(b.stycken.join(' ')).not.toMatch(/§|3 kap\./);
    });
    it('inga par och poängläget', () => {
        expect(avsnittBlock('lagreKrav', { par: [], kravProxy: 'bas' }, { k: 10 }).stycken.join(' ')).toContain('Inget kvinnodominerat yrke har lägre medianlön än ett yrke i lägre BAS.');
        const p = avsnittBlock('lagreKrav', { par: [], kravProxy: 'poäng' }, { k: 10 });
        expect(p.stycken.join(' ')).toContain('Med arbetsvärderingspoäng jämförs yrken över BAS-gränserna redan i Likvärdigt arbete.');
        expect(p.tabell).toBeNull();
    });
});

describe('formatTal', () => {
    it('visar aldrig −0 när ett negativt tal avrundas till noll', async () => {
        const { formatTal } = await import('../src/lib/rapportunderlag.js');
        expect(formatTal(-0.3)).toBe('0');
        expect(formatTal(-0.04, 1)).toBe('0,0');
        expect(formatTal(-12)).toMatch(/^[−-]12$/);
    });
});

describe('paravsnitten säger när listan är kapad', () => {
    const par = n => Array.from({ length: n }, (_, i) => ({ kvLabel: `F${i}`, kvBas: 'C', kvMedian: 36400, maLabel: 'I', maBas: 'B',
        basSteg: 1, gapKr: 1600, gapPct: 4.4, gapCI: null, kvN: 20, maN: 20 }));
    it('likvärdigt: när beräkningen nådde maxantalet står det att fler kan finnas', () => {
        const b = avsnittBlock('likvardigt', { par: par(20), exkluderade: 0, kravProxy: 'bas', kvinnoTroskel: 60, topN: 20 }, { k: 10 });
        expect(b.stycken[0]).toMatch(/de 20 största/i);
        expect(b.stycken.join(' ')).toMatch(/fler kan finnas/i);
    });
    it('likvärdigt: under maxantalet står det exakta antalet', () => {
        const b = avsnittBlock('likvardigt', { par: par(5), exkluderade: 0, kravProxy: 'bas', kvinnoTroskel: 60, topN: 20 }, { k: 10 });
        expect(b.stycken[0]).toMatch(/^5 kandidatpar/);
        expect(b.stycken.join(' ')).not.toMatch(/fler kan finnas/i);
    });
    it('lägre krav: samma regel, räknat före k-filtret', () => {
        const b = avsnittBlock('lagreKrav', { par: par(18), exkluderade: 2, kravProxy: 'bas', topN: 20 }, { k: 10 });
        expect(b.stycken.join(' ')).toMatch(/fler kan finnas/i);
    });
});

describe('rapportunderlag: sektorer', () => {
    const rad = (namn, extra) => ({ namn, n: 30, nKv: 15, nMa: 15, andelKv: 50, maskerad: false, samladMedian: false,
        medTot: 30000, medKv: 29000, medMa: 31000, kvot: 93.5, justerat: { pct: -3, low: -5, high: -1 }, justeratSkal: 'ok', antalAid: 2, punkter: 0, ...extra });
    it('ett block med en rad per redovisad sektor; ett kön under k ger ingen kvot', () => {
        const b = avsnittBlock('sektorer', { sektorer: [
            rad('Vård- och omsorgsarbete med mera'),
            rad('Teknikarbete', { nKv: 3, nMa: 27, samladMedian: true, medKv: null, medMa: null, kvot: null, justerat: null, justeratSkal: 'fa' }),
            rad('Okänt huvudområde', { n: 4, maskerad: true, medTot: null, medKv: null, medMa: null, kvot: null, justerat: null, justeratSkal: null }),
        ], andel: { gapKr: 3000, sektorKr: 1200, andel: 0.4 } }, { k: 10 });
        expect(b.rubrik).toMatch(/Per sektor/);
        expect(b.tabell.rader.map(r => r[0])).toEqual(['Vård- och omsorgsarbete med mera', 'Teknikarbete']);
        const teknik = b.tabell.rader[1];
        expect(teknik.slice(4)).toEqual(['–', '–']);   // kvot och justerad; kolumn 3 är SKR:s referens
        expect(b.stycken.join(' ')).toMatch(/1 sektor med färre än 10 personer redovisas inte/);
        expect(b.stycken.join(' ')).toMatch(/olika sektorer/);
    });
});

describe('rapportunderlag: sektorernas andel nära noll', () => {
    it('under 1 % sägs att skillnaden nästan inte alls beror på sektorerna', () => {
        const b = avsnittBlock('sektorer', { sektorer: [], andel: { gapKr: 6177, sektorKr: -2, andel: -0.0003 } }, { k: 10 });
        expect(b.stycken.join(' ')).toMatch(/nästan inte alls på att kvinnor och män arbetar i olika sektorer/);
        expect(b.stycken.join(' ')).not.toMatch(/−0,0|-0,0/);
    });
});

describe('rapportunderlag: not om minsta gruppstorlek', () => {
    const u = { n: 200, nKv: 100, nMa: 100, medKv: 36000, medMa: 40000 };
    it('står sist bland styckena när den anges, och saknas annars', () => {
        const med = avsnittBlock('sammanfattning', u, { k: 6, urval: 'Hela organisationen', troskelNot: 'NOT' });
        expect(med.stycken.at(-1)).toBe('NOT');
        expect(med.stycken.at(-2)).toBe('Urval: Hela organisationen.');
        const utan = avsnittBlock('sammanfattning', u, { k: 10, urval: 'Hela organisationen' });
        expect(utan.stycken.at(-1)).toBe('Urval: Hela organisationen.');
    });
});

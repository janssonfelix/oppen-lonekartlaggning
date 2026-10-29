import { describe, it, expect } from 'vitest';
import { byggPaket, tolkaPaket, PAKET_FORMAT, PAKET_MAX_BYTE } from '../src/lib/organisationspaket.js';
import { nyttRecept } from '../src/lib/tabellrecept.js';
import { perBasStandard } from '../src/lib/perbas.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const underlag = () => ({
    organisation: 'Exempelkommunen',
    utgivare: 'Lönefunktionen',
    skapat: '2026-10-01',
    avserAr: 2026,
    profil: { benchmarkLabel: 'Exempelkommunens lönestatistik', benchmarkLabelGenitive: 'Exempelkommunens lönestatistiks',
              benchmarkShort: 'statistiken', basSystem: 'BAS-intervall', aidSystem: 'AID-kod (SKR)' },
    installningar: { poPct: 38.5, poNot: 'Egen beräkning', months: 12 },
    referens: { namn: 'Lönepolitisk målbild 2026', kortnamn: 'Målbild 2026',
                rader: [{ aid: null, bas: 'A', p10: 25000, med: 28000, p90: 31000 }, { aid: null, bas: 'B', p10: 26000, med: 29000, p90: 32000 }] },
    statistik: { namn: 'Lönestatistik 2025',
                 rader: [{ aid: '5301', aidFull: '5301 Undersköterska', bas: 'C', median: 31000, p10: 28000, p90: 34500, nKv: 120, nMa: 18, andelKv: 87 }] },
});
const tolka = obj => tolkaPaket(JSON.stringify(obj));

describe('organisationspaket: rundresa', () => {
    it('bygga → serialisera → tolka ger samma delar', () => {
        const u = underlag();
        const r = tolka(byggPaket(u));
        expect(r.ok).toBe(true);
        expect(r.paket).toEqual({ organisation: 'Exempelkommunen', utgivare: 'Lönefunktionen', skapat: '2026-10-01', avserAr: 2026 });
        expect(r.delar.profil).toEqual({ name: 'Exempelkommunen', ...u.profil });
        expect(r.delar.installningar).toEqual(u.installningar);
        expect(r.delar.referens).toEqual(u.referens);
        expect(r.delar.statistik).toEqual(u.statistik);
        expect(r.varningar).toEqual([]);
    });
    it('paketet har format och version', () => {
        const p = byggPaket(underlag());
        expect(p.format).toBe(PAKET_FORMAT);
        expect(p.version).toBe(1);
    });
    it('tomma delar utelämnas', () => {
        const p = byggPaket({ ...underlag(), statistik: null });
        expect('statistik' in p).toBe(false);
    });
});

describe('organisationspaket: avvisning', () => {
    const fel = (text) => { const r = tolkaPaket(text); expect(r.ok).toBe(false); return r.fel; };
    it('inte JSON', () => expect(fel('{ inte json')).toMatch(/JSON/));
    it('fel format', () => expect(fel(JSON.stringify({ ...byggPaket(underlag()), format: 'annat' }))).toMatch(/organisationspaket/));
    it('nyare version', () => expect(fel(JSON.stringify({ ...byggPaket(underlag()), version: 2 }))).toMatch(/version/i));
    it('saknat organisationsnamn', () => {
        const p = byggPaket(underlag()); p.organisation = {};
        expect(fel(JSON.stringify(p))).toMatch(/organisation/);
    });
    it('saknat datum', () => {
        const p = byggPaket(underlag()); delete p.skapat;
        expect(fel(JSON.stringify(p))).toMatch(/skapat/);
    });
    it('varken referens eller statistik', () => {
        expect(fel(JSON.stringify(byggPaket({ ...underlag(), referens: null, statistik: null })))).toMatch(/ställningstagande|statistik/);
    });
    it('för stor fil', () => expect(fel(' '.repeat(PAKET_MAX_BYTE + 1))).toMatch(/stor/));
    it('personnummer eller e-post i ett textfält', () => {
        fel(JSON.stringify(byggPaket({ ...underlag(), utgivare: '19850101-1234' })));
        fel(JSON.stringify(byggPaket({ ...underlag(), organisation: 'a@b.se' })));
    });
});

describe('organisationspaket: delar och rader', () => {
    it('bara referens: statistiken är null och varningen säger det', () => {
        const r = tolka(byggPaket({ ...underlag(), statistik: null }));
        expect(r.ok).toBe(true);
        expect(r.delar.statistik).toBeNull();
        expect(r.varningar.join(' ')).toMatch(/statistik/i);
    });
    it('ogiltiga rader hoppas över och räknas', () => {
        const p = byggPaket(underlag());
        p.statistik.rader.push({ aid: '', bas: 'C', median: 30000 }, { aid: '1', bas: 'C', median: -5 }, { aid: '2', bas: 'D', median: 30000, andelKv: 120 });
        p.referens.rader.push({ bas: '', aid: null, med: 1 });
        const r = tolka(p);
        expect(r.delar.statistik.rader).toHaveLength(1);
        expect(r.delar.referens.rader).toHaveLength(2);
        expect(r.varningar.join(' ')).toMatch(/3 rader/);
    });
    it('alla rader ogiltiga: delen läses inte in', () => {
        const p = byggPaket(underlag());
        p.statistik.rader = [{ aid: '', median: 0 }];
        const r = tolka(p);
        expect(r.delar.statistik).toBeNull();
    });
});

describe('organisationspaket: vitlista och gränser', () => {
    it('okända fält och prototypnycklar försvinner', () => {
        const text = JSON.stringify({ ...byggPaket(underlag()), extra: 1, organisation: { namn: 'X', hemlig: 1 } })
            .replace(/^\{/, '{"__proto__":{"polluted":1},"constructor":{"x":1},');
        const r = tolkaPaket(text);
        expect(r.ok).toBe(true);
        expect(JSON.stringify(r)).not.toMatch(/extra|hemlig|polluted/);
        expect(({}).polluted).toBeUndefined();
    });
    it('HTML-metatecken tas bort ur textfälten: ett organisationsnamn med "<script>" läses in utan dem', () => {
        const r = tolka(byggPaket({ ...underlag(), organisation: 'Kommunen <script>alert(1)</script>', utgivare: 'Lön "HR"' }));
        expect(r.ok).toBe(true);
        expect(r.paket.organisation).toBe('Kommunen scriptalert(1)/script');
        expect(r.paket.utgivare).toBe('Lön HR');
        expect(`${r.paket.organisation}${r.paket.utgivare}`).not.toMatch(/[<>"'&]/);
    });
    it('strängar kortas till 200 tecken', () => {
        const r = tolka(byggPaket({ ...underlag(), utgivare: 'x'.repeat(500) }));
        expect(r.paket.utgivare).toHaveLength(200);
    });
    it('orimliga inställningar ignoreras', () => {
        const r = tolka(byggPaket({ ...underlag(), installningar: { poPct: 150, poNot: 'x', months: 40 } }));
        expect(r.delar.installningar.poPct).toBeUndefined();
        expect(r.delar.installningar.months).toBeUndefined();
        expect(r.delar.installningar.poNot).toBe('x');
    });
});

describe('organisationspaket: bara paketformatet läses', () => {
    it('en fil som inte är ett organisationspaket avvisas med besked', () => {
        const r = tolkaPaket(JSON.stringify({ name: 'X', benchmarkLabel: 'Y', poPctDefault: 38 }));
        expect(r.ok).toBe(false);
        expect(r.fel).toMatch(/organisationspaket/i);
    });
});

describe('organisationspaket: perioden', () => {
    it('perioden måste vara 3, 6, 9 eller 12 månader (verktygets val)', () => {
        const r = tolkaPaket(JSON.stringify(byggPaket({ ...underlag(), installningar: { months: 7 } })));
        expect(r.delar.installningar.months).toBeUndefined();
        const r2 = tolkaPaket(JSON.stringify(byggPaket({ ...underlag(), installningar: { months: 6 } })));
        expect(r2.delar.installningar.months).toBe(6);
    });
});

describe('organisationspaket: organisationstyp (kommun eller region)', () => {
    it('följer med i paketet och läses tillbaka', () => {
        const u = underlag();
        u.profil.orgTyp = 'region';
        const p = byggPaket(u);
        expect(p.profil.organisationstyp).toBe('region');
        expect(tolka(p).delar.profil.orgTyp).toBe('region');
    });
    it('okända värden läses inte in', () => {
        const p = byggPaket(underlag());
        p.profil.organisationstyp = 'stat';
        expect('orgTyp' in tolka(p).delar.profil).toBe(false);
    });
});

describe('organisationspaket: liknarPersonuppgift', () => {
    it('personnummer och e-post, men inte vanliga namn', async () => {
        const { liknarPersonuppgift } = await import('../src/lib/organisationspaket.js');
        expect(liknarPersonuppgift('Anna 19800101-1234')).toBe(true);
        expect(liknarPersonuppgift('hr@kommun.se')).toBe(true);
        expect(liknarPersonuppgift('Exempelkommunen 2026')).toBe(false);
    });
});

describe('organisationspaket: minsta gruppstorlek', () => {
    const bas = { organisation: 'Exempelorganisationen', skapat: '2026-10-08',
        referens: { rader: [{ bas: 'A', p10: 20000, med: 25000, p90: 30000 }] } };
    it('byggs och tolkas tur och retur', () => {
        const p = byggPaket({ ...bas, installningar: { kTroskel: 15 } });
        expect(p.installningar.kTroskel).toBe(15);
        expect(tolkaPaket(JSON.stringify(p)).delar.installningar.kTroskel).toBe(15);
    });
    it.each([1, 2.5, 1001, '12'])('ogiltigt värde %p tas inte med och ger en varning vid tolkning', v => {
        expect(byggPaket({ ...bas, installningar: { kTroskel: v } }).installningar.kTroskel).toBeUndefined();
        const p = byggPaket(bas);
        p.installningar = { kTroskel: v };
        const r = tolkaPaket(JSON.stringify(p));
        expect(r.ok).toBe(true);
        expect(r.delar.installningar.kTroskel).toBeUndefined();
        expect(r.varningar.join(' ')).toMatch(/minsta gruppstorlek/i);
    });
});

describe('organisationspaket: låsningar (ADR-47)', () => {
    const bas = { organisation: 'Exempelorganisationen', skapat: '2026-10-08',
        referens: { rader: [{ bas: 'A', p10: 20000, med: 25000, p90: 30000 }] } };
    const medInst = inst => { const p = byggPaket(bas); p.installningar = inst; return tolkaPaket(JSON.stringify(p)); };
    // Underlaget saknar jämförelsestatistik: den varningen hör inte till låsningarna.
    const varningar = r => r.varningar.filter(v => !/jämförelsestatistik/.test(v));
    const alla = { kTroskel: 12, kTroskelLagst: 8, inaktivitetMin: 45, inaktivitetLast: true, smaGrupperIExport: false };

    it('byggs och tolkas tur och retur', () => {
        const p = byggPaket({ ...bas, installningar: alla });
        expect(p.installningar).toEqual(alla);
        const r = tolkaPaket(JSON.stringify(p));
        expect(r.ok).toBe(true);
        expect(r.delar.installningar).toEqual(alla);
        expect(varningar(r)).toEqual([]);
    });
    it('standardvärdena (tillåtet, olåst) skrivs inte i paketet och läses inte in som fält', () => {
        expect(byggPaket({ ...bas, installningar: { smaGrupperIExport: true, inaktivitetLast: false } }).installningar).toEqual({});
        expect(medInst({}).delar.installningar).toEqual({});
        expect(medInst({ smaGrupperIExport: true, inaktivitetLast: false }).delar.installningar).toEqual({ smaGrupperIExport: true });
    });
    it.each([1, 1001, 2.5, '8', null])('ogiltigt golv %p utelämnas (med varning vid tolkning)', v => {
        expect(byggPaket({ ...bas, installningar: { kTroskelLagst: v } }).installningar.kTroskelLagst).toBeUndefined();
        const r = medInst({ kTroskelLagst: v });
        expect(r.ok).toBe(true);
        expect(r.delar.installningar.kTroskelLagst).toBeUndefined();
        if (v !== null) expect(r.varningar.join(' ')).toMatch(/lägsta tillåtna minsta gruppstorlek är ogiltig/i);
        else expect(varningar(r)).toEqual([]);
    });
    it('paketets egen tröskel under golvet höjs till golvet, med en varning', () => {
        const r = medInst({ kTroskel: 5, kTroskelLagst: 8 });
        expect(r.delar.installningar).toEqual({ kTroskel: 8, kTroskelLagst: 8 });
        expect(r.varningar.join(' ')).toMatch(/5 är lägre än dess lägsta tillåtna 8 och höjs till 8/);
    });
    it.each([0, 5, 120])('rensningstiden %p godtas', v => {
        expect(byggPaket({ ...bas, installningar: { inaktivitetMin: v } }).installningar.inaktivitetMin).toBe(v);
        const r = medInst({ inaktivitetMin: v });
        expect(r.delar.installningar.inaktivitetMin).toBe(v);
        expect(varningar(r)).toEqual([]);
    });
    it.each([3, 4, 121, 4.5, '30', -1, true])('ogiltig rensningstid %p utelämnas med varning', v => {
        expect(byggPaket({ ...bas, installningar: { inaktivitetMin: v } }).installningar.inaktivitetMin).toBeUndefined();
        const r = medInst({ inaktivitetMin: v });
        expect(r.delar.installningar.inaktivitetMin).toBeUndefined();
        expect(r.varningar.join(' ')).toMatch(/rensning vid inaktivitet är ogiltig \(0 eller 5–120 minuter\)/);
    });
    it('Av (0) kan inte låsas: värdet behålls, låsningen faller med en varning', () => {
        expect(byggPaket({ ...bas, installningar: { inaktivitetMin: 0, inaktivitetLast: true } }).installningar).toEqual({ inaktivitetMin: 0 });
        const r = medInst({ inaktivitetMin: 0, inaktivitetLast: true });
        expect(r.delar.installningar).toEqual({ inaktivitetMin: 0 });
        expect(r.varningar.join(' ')).toMatch(/kan inte låsas i läget Av/);
    });
    it('en låsning utan giltigt värde faller med en varning', () => {
        expect(byggPaket({ ...bas, installningar: { inaktivitetLast: true } }).installningar).toEqual({});
        const r = medInst({ inaktivitetLast: true });
        expect(r.delar.installningar).toEqual({});
        expect(r.varningar.join(' ')).toMatch(/låser rensning vid inaktivitet utan ett giltigt värde/);
        const r2 = medInst({ inaktivitetMin: 3, inaktivitetLast: true });
        expect(r2.delar.installningar).toEqual({});
        expect(varningar(r2)).toHaveLength(2);
    });
    it.each(['ja', 1, null])('låsningen %p som inte är boolesk utelämnas', v => {
        const r = medInst({ inaktivitetMin: 30, inaktivitetLast: v });
        expect(r.delar.installningar).toEqual({ inaktivitetMin: 30 });
        if (v !== null) expect(r.varningar.join(' ')).toMatch(/låsning av rensning vid inaktivitet är ogiltig/);
    });
    it.each(['nej', 0, null])('smaGrupperIExport %p som inte är boolesk utelämnas', v => {
        expect(byggPaket({ ...bas, installningar: { smaGrupperIExport: v } }).installningar.smaGrupperIExport).toBeUndefined();
        const r = medInst({ smaGrupperIExport: v });
        expect(r.delar.installningar.smaGrupperIExport).toBeUndefined();
        if (v !== null) expect(r.varningar.join(' ')).toMatch(/små grupper i exporten är ogiltigt/);
    });
});

describe('organisationspaket: exemplet i guiden', () => {
    // docs/anvandare/organisationspaket.md §7 visar ett komplett påhittat paket med låsningarna ifyllda.
    // Det ska läsas in utan varningar och bära alla tre låsningarna, så att guiden inte visar ett paket
    // som verktyget tolkar annorlunda än texten säger.
    const md = readFileSync(join(import.meta.dirname, '..', 'docs', 'anvandare', 'organisationspaket.md'), 'utf8');
    const json = /## 7\. Exempelpaket[\s\S]*?```json\n([\s\S]*?)\n```/.exec(md)?.[1];
    it('exemplet läses in utan varningar, med alla tre låsningarna', () => {
        expect(json).toBeTruthy();
        const t = tolkaPaket(/** @type {string} */ (json));
        expect(t.ok).toBe(true);
        if (!t.ok) return;
        expect(t.varningar).toEqual([]);
        expect(t.delar.installningar).toMatchObject({ kTroskel: 10, kTroskelLagst: 10, inaktivitetMin: 30, inaktivitetLast: true, smaGrupperIExport: false });
        expect(t.delar.referens?.rader.length).toBeGreaterThan(0);
        expect(t.delar.statistik?.rader.length).toBeGreaterThan(0);
    });
    it('exemplet är exakt det byggPaket ger för samma delar', () => {
        const t = tolkaPaket(/** @type {string} */ (json));
        if (!t.ok) throw new Error(t.fel);
        const d = t.delar, p = JSON.parse(/** @type {string} */ (json));
        const ombyggt = byggPaket({ organisation: t.paket.organisation, utgivare: t.paket.utgivare, skapat: t.paket.skapat,
            avserAr: t.paket.avserAr, profil: d.profil, installningar: d.installningar, referens: d.referens, statistik: d.statistik });
        expect(ombyggt).toEqual(p);
    });
});

describe('organisationspaket: rapportens recept (ADR-52)', () => {
    const recept = () => nyttRecept({ rad: 'aid', matt: 'median' }, { namn: 'Median per yrke' });
    it('egna tabeller och ett eget recept per BAS följer med och kommer tillbaka', () => {
        const r = recept();
        const perBas = { ...perBasStandard(), dim: 'sektor', matt: ['med'] };
        const p = byggPaket({ ...underlag(), rapport: { tabeller: [r], perBasRecept: perBas } });
        expect(p.rapport.tabeller).toEqual([r]);
        expect(p.rapport.perBasRecept).toMatchObject({ dim: 'sektor', matt: ['med'] });
        const t = tolka(p);
        expect(t.ok).toBe(true);
        expect(t.varningar).toEqual([]);
        expect(t.delar.rapport).toEqual({ tabeller: [r], perBasRecept: p.rapport.perBasRecept });
    });
    it('standardreceptet per BAS och tomma listor utelämnas; utan del är rapport null', () => {
        expect('rapport' in byggPaket({ ...underlag(), rapport: { tabeller: [], perBasRecept: perBasStandard() } })).toBe(false);
        expect(tolka(byggPaket(underlag())).delar.rapport).toBeNull();
        const p = byggPaket({ ...underlag(), rapport: { tabeller: [recept()], perBasRecept: perBasStandard() } });
        expect('perBasRecept' in p.rapport).toBe(false);
    });
    it('ett ogiltigt tabellrecept hoppas över med en varning; ett okänt BAS-recept blir standard och utelämnas', () => {
        const p = byggPaket({ ...underlag(), rapport: { tabeller: [recept()] } });
        p.rapport.tabeller.push({ id: 'x', namn: 'Trasig', spec: { rad: 'finns-inte', matt: 'median' } });
        p.rapport.perBasRecept = { dim: 'galax' };
        const t = tolka(p);
        expect(t.ok).toBe(true);
        expect(t.varningar).toEqual(['1 egen tabell i paketet gick inte att läsa och hoppas över.']);
        expect(t.delar.rapport.tabeller).toHaveLength(1);
        expect('perBasRecept' in t.delar.rapport).toBe(false);
    });
    it('ett receptnamn som liknar en personuppgift stoppar paketet', () => {
        const r = nyttRecept({ rad: 'aid', matt: 'median' }, { namn: 'Anna 19850101-1234' });
        const t = tolka(byggPaket({ ...underlag(), rapport: { tabeller: [r] } }));
        expect(t.ok).toBe(false);
    });
});

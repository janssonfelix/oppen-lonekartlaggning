import { describe, it, expect } from 'vitest';
import { lageISpann, monster, forslag, referensOverblick, hantelRader } from '../src/lib/referenser.js';
const rad = (over = {}) => ({ aid: '1', yrke: '1 Yrke', bas: 'C', n: 42, org: { p10: 34100, median: 38900, p90: 44200 },
    stallningstagande: { p10: 29000, median: 32000, p90: 36000 }, statistik: { p10: 33700, median: 37800, p90: 42900 }, ...over });
const alla = { harStatistik: true, harStallningstagande: true, statistikHarSpann: true };
describe('läge i spannet', () => {
    it('0 vid P10, 100 vid P90, över 100 ovanför, null utan spann', () => {
        expect(lageISpann(29000, { p10: 29000, p90: 36000 })).toEqual({ pos: 0, ord: 'i nedre delen' });
        expect(lageISpann(36000, { p10: 29000, p90: 36000 }).pos).toBe(100);
        expect(lageISpann(38900, { p10: 29000, p90: 36000 }).ord).toBe('ovanför');
        expect(lageISpann(28000, { p10: 29000, p90: 36000 }).ord).toBe('nedanför');
        expect(lageISpann(38900, { p10: null, p90: null })).toEqual({ pos: null, ord: '' });
    });
    it('gränserna 33 och 67 hör till den övre delen av sitt intervall', () => {
        expect(lageISpann(133, { p10: 100, p90: 200 }).ord).toBe('mitt i');
        expect(lageISpann(167, { p10: 100, p90: 200 }).ord).toBe('i övre delen');
        expect(lageISpann(200, { p10: 100, p90: 200 }).ord).toBe('i övre delen');
    });
});
describe('mönster och förslag', () => {
    it('löneläget ovanför ställningstagandet och statistiken också över', () => {
        expect(monster(rad())).toEqual({ lonelage: 'ovanför', statistik: 'över', text: 'löneläget ovanför ställningstagandet, statistiken också över' });
        expect(forslag(rad())).toMatchObject({ referens: 'statistik', skal: expect.stringContaining('löneläget ligger ovanför ställningstagandet') });
    });
    it('inom båda ger ställningstagandet; bara statistik ger statistiken', () => {
        const inom = rad({ org: { p10: 30000, median: 32500, p90: 35000 }, statistik: { p10: 30500, median: 33000, p90: 35500 } });
        expect(monster(inom)).toMatchObject({ lonelage: 'inom', statistik: 'inom', text: 'löneläget inom ställningstagandet, statistiken också inom' });
        expect(forslag(inom).referens).toBe('stallningstagande');
        expect(forslag(rad({ stallningstagande: { p10: null, median: null, p90: null } })).referens).toBe('statistik');
    });
    it('statistik med bara median: mönstret räknas på medianen men läget mot statistiken är null', () => {
        const r = rad({ statistik: { p10: null, median: 37800, p90: null } });
        expect(monster(r).statistik).toBe('över');
        expect(referensOverblick([r], { ...alla, statistikHarSpann: false }).grupper[0].lage.statistik.pos).toBeNull();
    });
    it('utanför båda: den referens vars spann ligger närmast, och orden gäller löneläget', () => {
        const r = rad({ org: { p10: 44000, median: 45000, p90: 46000 } });
        expect(forslag(r)).toEqual({ referens: 'statistik', skal: 'löneläget ligger ovanför statistiken' });
        const under = rad({ org: { p10: 26000, median: 27000, p90: 28000 } });
        expect(forslag(under)).toEqual({ referens: 'stallningstagande', skal: 'löneläget ligger nedanför ställningstagandet' });
    });
    it('saknas ställningstagandet säger mönstret det, och orden gäller löneläget mot statistiken', () => {
        const r = rad({ stallningstagande: { p10: null, median: null, p90: null } });
        expect(monster(r)).toEqual({ lonelage: null, statistik: null, text: 'ställningstagande saknas; löneläget inom statistiken' });
    });
    it('bara median i statistiken och löneläget utanför ställningstagandet: förslaget håller sig till spannet som finns', () => {
        const r = rad({ statistik: { p10: null, median: 37800, p90: null } });
        expect(forslag(r)).toEqual({ referens: 'stallningstagande', skal: 'löneläget ligger ovanför ställningstagandet' });
    });
    it('ingen referens: inget förslag, inget mönster', () => {
        const tom = { p10: null, median: null, p90: null };
        const r = rad({ stallningstagande: tom, statistik: tom });
        expect(forslag(r)).toEqual({ referens: null, skal: '' });
        expect(monster(r).text).toBe('');
    });
});
describe('överblicken', () => {
    const tva = () => [rad(), rad({ aid: '2', yrke: '2 Annat', n: 58, org: { p10: 30000, median: 32500, p90: 35000 }, statistik: { p10: 30500, median: 33000, p90: 35500 } })];
    it('räknar grupper, personer och andel per mönster, förslag och vägda medianskillnader', () => {
        const o = referensOverblick(tva(), alla);
        expect(o.tal.antalGrupper).toBe(2);
        expect(o.tal.perMonster.badaOver).toEqual({ grupper: 1, personer: 42, andel: 42 });
        expect(o.tal.perMonster.badaInom).toEqual({ grupper: 1, personer: 58, andel: 58 });
        expect(o.tal.forslagStatistik).toBe(1);
        expect(o.tal.vagdMedianMotStallningstagandePct).toBeCloseTo((42 * (38900 / 32000 - 1) * 100 + 58 * (32500 / 32000 - 1) * 100) / 100, 6);
        expect(o.statistikMotStallningstagande[0]).toMatchObject({ yrke: '1 Yrke', median: expect.closeTo((37800 / 32000 - 1) * 100, 6) });
    });
    it('listan har grupper utanför spannet först, längst bort överst', () => {
        const nara = rad({ aid: '3', yrke: '3 Nära', org: { p10: 34000, median: 36500, p90: 39000 } });
        const inom = rad({ aid: '0', yrke: '0 Inom', org: { p10: 30000, median: 32500, p90: 35000 } });
        expect(referensOverblick([inom, nara, rad()], alla).grupper.map(g => g.yrke)).toEqual(['1 Yrke', '3 Nära', '0 Inom']);
    });
    it('statistiken mot ställningstagandet sorteras fallande och visar båda ändarna', () => {
        const lag = rad({ aid: '4', yrke: '4 Låg', statistik: { p10: 26000, median: 30000, p90: 34000 } });
        const o = referensOverblick([lag, rad()], alla).statistikMotStallningstagande;
        expect(o.map(r => r.yrke)).toEqual(['1 Yrke', '4 Låg']);
        expect(o[1].median).toBeLessThan(0);
    });
    it('en grupp utan rad i statistiken får null där och räknas inte i statistikens tal', () => {
        const o = referensOverblick([rad({ statistik: { p10: null, median: null, p90: null } })], alla);
        expect(o.grupper[0].monster.statistik).toBeNull();
        expect(o.grupper[0].monster.text).toBe('löneläget ovanför ställningstagandet');
        expect(o.statistikMotStallningstagande).toEqual([]);
        expect(o.tal.vagdMedianMotStatistikPct).toBeNull();
    });
    it('hantelns rader bär de tre spannen i listans ordning, null för en referens utan median', () => {
        const h = hantelRader(referensOverblick(tva(), alla).grupper);
        expect(h).toHaveLength(2);
        expect(h[0]).toMatchObject({ namn: '1 Yrke · BAS C', org: { median: 38900 }, stallningstagande: { median: 32000 }, statistik: { median: 37800 } });
        expect(hantelRader(referensOverblick([rad({ statistik: { p10: null, median: null, p90: null } })], alla).grupper)[0].statistik).toBeNull();
    });
});

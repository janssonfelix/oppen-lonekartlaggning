import { describe, it, expect } from 'vitest';
import { aidKriterier } from '../src/lib/aidkontroll.js';

const r = (aid, lon = 30000, extra = {}) => ({ aid, lon, kon: 'kvinna', alder: 40, bas: 'C', ...extra });
const ggr = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const hitta = (lista, id) => lista.find(c => c.id === id);

describe('aidkontroll', () => {
    it('okända koder: kod utanför listan eller utan huvudområde', () => {
        const k = aidKriterier([r('207011'), r('751010'), r('5301')], { k: 10, harAnsvar: false });
        const c = hitta(k, 'aid-okanda');
        expect(c.status).toBe('varning');
        expect(c.varde).toBe(2);
        expect(c.text).toMatch(/1 person har en AID-kod som inte finns.*1 person saknar en sexsiffrig AID-kod/);
        expect(hitta(aidKriterier([r('207011')], { k: 10 }), 'aid-okanda').status).toBe('ok');
    });
    it('restkoder: varning över 10 %', () => {
        expect(hitta(aidKriterier([...ggr(8, () => r('207011')), ...ggr(2, () => r('207090'))], { k: 10 }), 'aid-restkoder').status).toBe('varning');
        expect(hitta(aidKriterier([...ggr(9, () => r('207011')), r('207090')], { k: 10 }), 'aid-restkoder').status).toBe('ok');
        expect(hitta(aidKriterier([r('207011')], { k: 10 }), 'aid-restkoder').text).toBe('Ingen har en restkod (…090).');
    });
    it('stor spridning: P90/P10 > 1,6 i en grupp med minst k personer', () => {
        const bred = ggr(10, i => r('207011', i < 5 ? 25000 : 45000));
        const c = hitta(aidKriterier(bred, { k: 10 }), 'aid-spridning');
        expect(c.status).toBe('varning');
        expect(c.text).toMatch(/207011/);
        expect(hitta(aidKriterier(ggr(10, i => r('207011', 30000 + i * 100)), { k: 10 }), 'aid-spridning').status).toBe('ok');
        expect(hitta(aidKriterier(ggr(5, i => r('207011', i < 2 ? 20000 : 50000)), { k: 10 }), 'aid-spridning').status).toBe('ok');   // under k
    });
    it('ansvarskoderna kontrolleras bara när fältet finns', () => {
        const rader = [r('103511', 50000, { ansvarskoder: [] }), r('207011', 30000, { ansvarskoder: ['A'] }),
                       r('101010', 60000, { ansvarskoder: ['F'] }), r('207011', 30000, { ansvarskoder: ['M'] }),
                       r('401010', 35000, { ansvarskoder: ['1002'] }), r('207011', 30000, { ansvarskoder: ['C'] })];
        const utan = aidKriterier(rader, { k: 10, harAnsvar: false });
        expect(hitta(utan, 'aid-ledning-utan-ansvar')).toBeUndefined();
        const med = aidKriterier(rader, { k: 10, harAnsvar: true });
        expect(hitta(med, 'aid-ledning-utan-ansvar').varde).toBe(2);        // 103511 utan kod, 101010 med bara F
        expect(hitta(med, 'aid-otillaten-ansvarskod').varde).toBe(3);       // A på 207011, F på 101010, M på 207011
    });
    it('inga enskilda personer i texterna, bara antal och koder', () => {
        const k = aidKriterier([r('751010', 43291)], { k: 10 });
        expect(JSON.stringify(k)).not.toMatch(/43291/);
    });
});

describe('aidkontroll: yrkeskolumn utan AID-koder', () => {
    it('ingen AID-kontroll alls när ingen rad har en sexsiffrig kod', () => {
        expect(aidKriterier(ggr(30, i => r('', 25000 + (i % 2) * 20000)), { k: 10, harAnsvar: false })).toEqual([]);
    });
    it('rader utan kod redovisas för sig och ingår inte i spridningen', () => {
        const rader = [...ggr(20, i => r('207011', 30000 + i * 10)), ...ggr(12, i => r('', i % 2 ? 20000 : 50000))];
        const k = aidKriterier(rader, { k: 10 });
        const ok = hitta(k, 'aid-okanda');
        expect(ok.status).toBe('varning');
        expect(ok.text).toMatch(/12 personer saknar en sexsiffrig AID-kod/);
        expect(ok.text).not.toMatch(/t\.ex\. \)/);
        expect(hitta(k, 'aid-spridning').status).toBe('ok');
    });
});

/**
 * Att göra och processöversikten (ADR-29): ren logik i src/lib/attgora.js.
 * Ordningen i Börja här och när ett analyssteg räknas som klart.
 */
import { describe, it, expect } from 'vitest';
import { attGoraRang, borjaHar, hanterade, stegLikaArbete, stegLikvardigt } from '../src/lib/attgora.js';

const p = (id, kategori, prioritet = 'hög') => ({ id, kategori, prioritet });

describe('attgora: rang inom samma prioritet', () => {
    it('underlaget först, sedan könsrelaterade fynd, sist övrigt', () => {
        expect(attGoraRang(p('a', 'Underlagets kvalitet'))).toBe(0);
        expect(attGoraRang(p('b', 'Datakvalitet'))).toBe(0);
        expect(attGoraRang(p('c', 'Lika arbete'))).toBe(1);
        expect(attGoraRang(p('d', 'EU 2023/970'))).toBe(1);
        expect(attGoraRang(p('e', 'Likvärdigt arbete'))).toBe(1);
        expect(attGoraRang(p('f', 'Värt att börja med'))).toBe(2);
        expect(attGoraRang(p('g', 'Livscykel'))).toBe(2);
    });
});

describe('attgora: Börja här', () => {
    const punkter = [
        p('pol', 'Värt att börja med'), p('eu', 'EU 2023/970'), p('dq', 'Underlagets kvalitet', 'medel'),
        p('lv', 'Likvärdigt arbete'), p('liv', 'Livscykel', 'medel'), p('data', 'Datakvalitet'),
    ];
    it('prioritet först, därefter rang, därefter ursprunglig ordning; högst tre', () => {
        expect(borjaHar(punkter, new Set()).map(x => x.id)).toEqual(['data', 'eu', 'lv']);
    });
    it('avbockade punkter hoppas över', () => {
        expect(borjaHar(punkter, new Set(['data', 'eu'])).map(x => x.id)).toEqual(['lv', 'pol', 'dq']);
    });
    it('antalet kan väljas, och allt avbockat ger en tom lista', () => {
        expect(borjaHar(punkter, new Set(), 1).map(x => x.id)).toEqual(['data']);
        expect(borjaHar(punkter, new Set(punkter.map(x => x.id)))).toEqual([]);
    });
});

describe('attgora: hanterade punkter per kategori', () => {
    it('räknar totalt och avbockat inom kategorierna', () => {
        const punkter = [p('a', 'Lika arbete'), p('b', 'EU 2023/970'), p('c', 'Likvärdigt arbete')];
        expect(hanterade(punkter, new Set(['a']), ['Lika arbete', 'EU 2023/970'])).toEqual({ t: 2, d: 1 });
        expect(hanterade(punkter, new Set(), ['Livscykel'])).toEqual({ t: 0, d: 0 });
    });
});

describe('attgora: processöversiktens steg (ADR-29)', () => {
    it('lika arbete: klart först när regressionen gått och alla punkter är hanterade', () => {
        expect(stegLikaArbete({ regressionOk: false, t: 0, d: 0 }).status).toBe('delvis');
        expect(stegLikaArbete({ regressionOk: true, t: 3, d: 1 })).toEqual({ status: 'delvis', detail: 'Oförklarat gap beräknat · 1 av 3 punkter hanterade i Att göra.' });
        expect(stegLikaArbete({ regressionOk: true, t: 3, d: 3 }).status).toBe('klar');
        expect(stegLikaArbete({ regressionOk: true, t: 0, d: 0 })).toEqual({ status: 'klar', detail: 'Oförklarat gap beräknat — inga punkter att förklara eller åtgärda.' });
    });
    it('likvärdigt arbete: inga par är klart; par kräver att punkterna är hanterade', () => {
        expect(stegLikvardigt({ analys: false, antalPar: 0, t: 0, d: 0 }).status).toBe('ej');
        expect(stegLikvardigt({ analys: true, antalPar: 0, t: 0, d: 0 }).status).toBe('klar');
        expect(stegLikvardigt({ analys: true, antalPar: 2, t: 2, d: 0 })).toEqual({ status: 'delvis',
            detail: '2 kandidatpar (kvinnodominerade mot likvärdiga yrken) · 0 av 2 kandidatpar hanterade i Att göra.' });
        expect(stegLikvardigt({ analys: true, antalPar: 2, t: 2, d: 2 }).status).toBe('klar');
        // Par som inte kom med i Att göra (t = 0) räknas inte som hanterade.
        expect(stegLikvardigt({ analys: true, antalPar: 2, t: 0, d: 0 }).status).toBe('delvis');
    });
});

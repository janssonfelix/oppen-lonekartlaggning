/**
 * AID-hierarkin och generatorns tolkning av etikettlistan.
 */
import { describe, it, expect } from 'vitest';
import { HUVUDOMRADEN, OKANT_HUVUDOMRADE, normaliseraAid, huvudomrade, sektorsnamn, mellanniva,
    mellannivaEtikett, etikett, arRestkod, arLedningsetikett, jamforSektor, etikettlistaInfo } from '../src/lib/aid.js';
import { aidEtikettlista } from '../src/lib/aid-etiketter.js';
import { tolkaMojligaAnsvarskoder, etiketterFranRader } from '../tools/gen-aid-etiketter.mjs';

describe('aid: hierarkin', () => {
    it('har de 13 huvudområdena i handbokens ordning', () => {
        expect(HUVUDOMRADEN.map(h => h.prefix)).toEqual(['10', '15', '20', '25', '30', '35', '40', '45', '50', '52', '55', '60', '65']);
        expect(huvudomrade('207011')).toEqual({ prefix: '20', namn: 'Vård- och omsorgsarbete med mera' });
        expect(huvudomrade('521015').namn).toBe('Vaktmästeri, trädgård, anläggning med mera');
        expect(huvudomrade('502010').namn).toBe('Teknikarbete');
    });
    it('normaliserar: sex siffror först i fältet, annars inget', () => {
        expect(normaliseraAid('207011')).toBe('207011');
        expect(normaliseraAid(' 207011 Undersköterska')).toBe('207011');
        expect(normaliseraAid(207011)).toBe('207011');
        for (const fel of ['20701', '2070110', 'Kod 207011', '', null, undefined]) expect(normaliseraAid(fel), String(fel)).toBeNull();
    });
    it('okända koder får inget huvudområde men kraschar inte', () => {
        expect(huvudomrade('751010')).toBeNull();
        expect(sektorsnamn('751010')).toBe(OKANT_HUVUDOMRADE);
        expect(sektorsnamn('5301')).toBe(OKANT_HUVUDOMRADE);
        expect(etikett('751010')).toBeNull();
    });
    it('mellannivå och restkoder', () => {
        expect(mellanniva('207011')).toBe('2070');
        expect(mellannivaEtikett('207011')).toBe('AID 2070xx');
        expect(mellanniva('20701')).toBeNull();
        expect(arRestkod('403090')).toBe(true);
        expect(arRestkod('207090')).toBe(true);
        expect(arRestkod('207011')).toBe(false);
        expect(arLedningsetikett('103511')).toBe(true);
        expect(arLedningsetikett('207011')).toBe(false);
    });
    it('etikettlistan ger namn och möjliga ansvarskoder', () => {
        expect(etikett('207011')).toEqual({ kod: '207011', namn: 'Undersköterska, särskilt boende', ansvarskoder: ['B', 'C', 'L', 'F'] });
        expect(etikett('401010').ansvarskoder).toEqual(['B', 'C', 'L', 'F', '1001', '1002']);
        expect(etikett('101010').ansvarskoder).toEqual(['A']);
        const info = etikettlistaInfo();
        expect(info.version).toBe('2026-09-23');
        expect(info.antal).toBe(232);
        expect(info.kalla).toMatch(/SKR/);
    });
    it('varje etikett i listan ligger i ett av de 13 huvudområdena', () => {
        const utan = aidEtikettlista().etiketter.map(([kod]) => kod).filter(kod => !huvudomrade(kod));
        expect(utan).toEqual([]);
    });
    it('sektorer sorteras i prefixordning, okänt sist', () => {
        const namn = [OKANT_HUVUDOMRADE, 'Teknikarbete', 'Ledningsarbete', 'Vård- och omsorgsarbete med mera'];
        expect(namn.sort(jamforSektor)).toEqual(['Ledningsarbete', 'Vård- och omsorgsarbete med mera', 'Teknikarbete', OKANT_HUVUDOMRADE]);
    });
});

describe('aid: generatorn tolkar etikettlistan', () => {
    it('alla varianter av möjliga ansvarskoder', () => {
        expect(tolkaMojligaAnsvarskoder('A')).toEqual(['A']);
        expect(tolkaMojligaAnsvarskoder('A, B, C och L ')).toEqual(['A', 'B', 'C', 'L']);
        expect(tolkaMojligaAnsvarskoder('A, B, C och L samt annat uttalat ansvar')).toEqual(['A', 'B', 'C', 'L', '1001', '1002']);
        expect(tolkaMojligaAnsvarskoder('B, C, L och F samt M')).toEqual(['B', 'C', 'L', 'F', 'M']);
        expect(tolkaMojligaAnsvarskoder('B, C, L och F\n\nSpecialist-sjukhusfysiker ska ha ansvarskod F.')).toEqual(['B', 'C', 'L', 'F']);
        expect(tolkaMojligaAnsvarskoder('')).toEqual([]);
    });
    it('bara rader med sexsiffrig kod blir etiketter', () => {
        const rader = [['Etikett AID', '', '', '', '', 'Möjliga'], ['', 'Ledningsarbete \nKompletterande …'],
            [101010, 'Ledning, övergripande', 'Leder …', 'T.ex. …', '', 'A'], [207011, 'Undersköterska, särskilt\nboende', '', '', '', 'B, C, L och F']];
        expect(etiketterFranRader(rader)).toEqual([['101010', 'Ledning, övergripande', 'A'], ['207011', 'Undersköterska, särskilt boende', 'B,C,L,F']]);
    });
});

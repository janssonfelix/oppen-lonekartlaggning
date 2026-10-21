/**
 * SKR:s personalstatistik som referens för kvinnoandel per AID-etikett, prefix och sektor.
 */
import { describe, it, expect } from 'vitest';
import { skrKvinnoandel, skrKvinnoandelPrefix, skrKvinnoandelSektor, skrReferensInfo } from '../src/lib/skrreferens.js';
import { skrPersonalstatistik } from '../src/lib/skr-personal.js';
import { etiketterFranTabell, slaIhopTabeller } from '../tools/gen-skr-personal.mjs';
import { aidEtikettlista } from '../src/lib/aid-etiketter.js';

const rad = kod => skrPersonalstatistik().etiketter.find(e => e[0] === kod);

describe('skrreferens: kvinnoandel per AID-etikett', () => {
    it('etikett: kommuner och regioner vägda med antal anställningar', () => {
        const [, nK, pK, nR, pR] = rad('207011');
        const r = skrKvinnoandel('207011');
        expect(r.niva).toBe('etikett');
        expect(r.n).toBe(nK + nR);
        expect(r.pct).toBeCloseTo((nK * pK + nR * pR) / (nK + nR), 6);
    });
    it('etikett med dold andel i ena delen använder bara den del som redovisas', () => {
        const [, nK, pK, nR, pR] = rad('207016');   // kommunernas ambulanssjukvårdare: andelen dold
        expect(pK).toBeNull();
        const r = skrKvinnoandel('207016');
        expect(r.niva).toBe('etikett');
        expect(r.pct).toBeCloseTo(pR, 6);
        expect(r.n).toBe(nR);
        expect(nK).toBeGreaterThan(0);
    });
    it('okänd etikett, eller etikett där SKR döljer andelen helt, faller tillbaka på prefixet', () => {
        expect(skrKvinnoandel('521010')).toMatchObject({ niva: 'prefix', prefix: '521' });   // elektriker: dold i båda
        const r = skrKvinnoandel('521099');
        expect(r).toMatchObject({ niva: 'prefix', prefix: '521' });
        expect(r.pct).toBeCloseTo(skrKvinnoandelPrefix('521').pct, 9);
        expect(skrKvinnoandel('751010')).toBeNull();
        expect(skrKvinnoandel('5301')).toBeNull();
        expect(skrKvinnoandel(' 207011 Undersköterska').niva).toBe('etikett');
    });
});

describe('skrreferens: prefix och sektor', () => {
    it('prefix enligt den fastställda beräkningen', () => {
        expect(skrKvinnoandelPrefix('521').pct).toBeCloseTo(17.3, 1);
        expect(skrKvinnoandelPrefix('105').pct).toBeCloseTo(38.9, 1);
        expect(skrKvinnoandelPrefix('205').pct).toBeCloseTo(99.7, 1);
        expect(skrKvinnoandelPrefix('999')).toBeNull();
    });
    it('sektor = AID-huvudområde', () => {
        const t = skrKvinnoandelSektor('Teknikarbete');
        expect(t.pct).toBeGreaterThan(15);
        expect(t.pct).toBeLessThan(40);
        expect(skrKvinnoandelSektor('Vård- och omsorgsarbete med mera').pct).toBeGreaterThan(75);
        expect(skrKvinnoandelSektor('Okänt huvudområde')).toBeNull();
    });
    it('källa och period', () => {
        expect(skrReferensInfo()).toMatchObject({ period: '2025-11', kalla: expect.stringMatching(/^SKR, personalstatistik november 2025/) });
    });
    it('varje prefix i etikettlistan har ett referensvärde', () => {
        const prefix = [...new Set(aidEtikettlista().etiketter.map(([k]) => k.slice(0, 3)))];
        expect(prefix.filter(p => !skrKvinnoandelPrefix(p))).toEqual([]);
    });
});

describe('generatorn tolkar SKR:s tabeller', () => {
    it('bara rader med sexsiffrig kod och antal; dold andel blir null', () => {
        const rader = [['Tabell 4'], ['Personalområde/AID-etikett', 'Klartext', 'antal', '% kvinnor'],
            ['Ledning, utveckling och stöd', '', 116179, 76], ['', 'Ledningsarbete', 41888, 73.1],
            ['101010', 'Ledning, övergripande', 340, 48.5], ['521010', 'Elektriker', 292, '**'], ['208016', 'Lab', '**', '**']];
        const m = etiketterFranTabell(rader);
        expect([...m]).toEqual([['101010', { n: 340, pct: 48.5 }], ['521010', { n: 292, pct: null }]]);
        expect(slaIhopTabeller(m, new Map([['521010', { n: 100, pct: 20 }]]))).toEqual([
            ['101010', 340, 48.5, 0, null], ['521010', 292, null, 100, 20]]);
    });
});

describe('skrreferens: kommun eller region', async () => {
    const { skrDelText } = await import('../src/lib/skrreferens.js');
    it('etiketten slås upp i den valda delen', () => {
        const [, nK, pK, nR, pR] = rad('207011');
        const k = skrKvinnoandel('207011', { del: 'kommun' }), r = skrKvinnoandel('207011', { del: 'region' });
        expect(k).toMatchObject({ del: 'kommun', niva: 'etikett', n: nK });
        expect(k.pct).toBeCloseTo(pK, 9);
        expect(r).toMatchObject({ del: 'region', niva: 'etikett', n: nR });
        expect(r.pct).toBeCloseTo(pR, 9);
        expect(skrKvinnoandel('207011').del).toBe('alla');
    });
    it('finns yrket inte alls i delen används kommuner och regioner tillsammans', () => {
        const r = skrKvinnoandel('205010', { del: 'kommun' });   // barnmorskor finns bara i regionerna
        expect(r).toMatchObject({ del: 'alla', niva: 'etikett' });
    });
    it('saknas etiketten i delen men prefixet finns används prefixet i delen', () => {
        const [, nK] = rad('204610');   // psykoterapeut: inga i kommunerna
        expect(nK).toBe(0);
        expect(skrKvinnoandel('204610', { del: 'kommun' })).toMatchObject({ del: 'kommun', niva: 'prefix', prefix: '204' });
    });
    it('sektor per del och text för delen', () => {
        expect(skrKvinnoandelSektor('Teknikarbete', { del: 'region' }).del).toBe('region');
        expect(skrKvinnoandelSektor('Teknikarbete', { del: 'kommun' }).pct)
            .not.toBeCloseTo(skrKvinnoandelSektor('Teknikarbete', { del: 'region' }).pct, 1);
        expect(skrDelText('kommun')).toBe('kommuner');
        expect(skrDelText('region')).toBe('regioner');
        expect(skrDelText('alla')).toBe('kommuner och regioner');
    });
});

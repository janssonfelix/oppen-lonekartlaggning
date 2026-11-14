/**
 * Uppmärksamhetstrappan (ADR-59, beslut 1a): statusen sätts på statistisk signal, inte på storleken ensam.
 *
 *   Värt att granska — skillnaden är säkerställd (slumpens gränser för gruppen) OCH minst 3 % (verktygets
 *                      storleksgräns).
 *   Följ upp         — minst 3 % men inte säkerställd, eller säkerställd men under 3 %.
 *   Balanserat       — under 3 % och inte säkerställd.
 *   Går ej att bedöma — något kön är under golvet (statGolv i appen).
 *
 * Direktivmarkeringen (≥ 5 %) är något annat: den följer den OJUSTERADE medianskillnaden och står aldrig på
 * regressionens justerade tal.
 *
 * Vaktar: R28 (docs/utveckling/regler.md)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statusNiva, direktivMarkering, slumpensGranser, bedomSkillnad, perBasSignal, STORLEKSGRANS, DIREKTIVNIVA,
    STATUS_ORD, DIREKTIV_TIPS, DIREKTIV_KOLUMN } from '../src/lib/status.js';
import { likaArbeteGrupper, stabilitetKort, avsnittBlock } from '../src/lib/rapportunderlag.js';

const person = (yrke, kon, lon) => ({ yrke, kon, lon, alder: 40, bas: 'C' });
/** n löner jämnt fördelade kring `mitt` med relativ halvbredd `spann` (deterministiskt). */
const loner = (n, mitt, spann) => Array.from({ length: n }, (_, i) => Math.round(mitt * (1 + spann * (2 * i / (n - 1) - 1))));
const yrke = (namn, kv, ma) => [...kv.map(l => person(namn, 'kvinna', l)), ...ma.map(l => person(namn, 'man', l))];

describe('statusNiva: trappan', () => {
    it('säkerställd och minst 3 % är Värt att granska', () => {
        expect(statusNiva(4, true)).toBe('granska');
        expect(statusNiva(3, true)).toBe('granska');
    });
    it('minst 3 % utan säkerställd skillnad, eller säkerställd under 3 %, är Följ upp', () => {
        expect(statusNiva(6, false)).toBe('folj');
        expect(statusNiva(8, false)).toBe('folj');
        expect(statusNiva(1.5, true)).toBe('folj');
    });
    it('under 3 % och inte säkerställd är Balanserat', () => {
        expect(statusNiva(2.9, false)).toBe('balanserat');
        expect(statusNiva(0, false)).toBe('balanserat');
    });
    it('utan prövning (null) eller utan tal går det inte att bedöma', () => {
        expect(statusNiva(8, null)).toBe('ejbedomd');
        expect(statusNiva(NaN, true)).toBe('ejbedomd');
    });
    it('gränserna är 3 och 5 %, och ingen status bygger på 5 %', () => {
        expect(STORLEKSGRANS).toBe(3);
        expect(DIREKTIVNIVA).toBe(5);
        for (const s of Object.values(STATUS_ORD)) expect(s.grans).not.toMatch(/5\s*%/);
    });
});

describe('bedomSkillnad: en grupp mot slumpens gränser', () => {
    it('en grupp med 18 kvinnor och 2 män och 8 % skillnad är inte Värt att granska', () => {
        const kv = loner(18, 92000, 0.15), ma = loner(2, 100000, 0.15);
        // Under golvet (10 per kön): går inte att bedöma.
        expect(bedomSkillnad(kv, ma, { golv: 10 }).niva).toBe('ejbedomd');
        // Också utan golv: två män räcker inte för att skillnaden ska vara säkerställd.
        const b = bedomSkillnad(kv, ma, { golv: 2 });
        expect(b.sakerstalld).toBe(false);
        expect(b.niva).not.toBe('granska');
    });
    it('en grupp med 30/30 och 4 % säkerställd skillnad är Värt att granska', () => {
        const b = bedomSkillnad(loner(30, 96000, 0.02), loner(30, 100000, 0.02), { golv: 10 });
        expect(b.avstand).toBeCloseTo(4, 5);
        expect(b.sakerstalld).toBe(true);
        expect(b.niva).toBe('granska');
        expect(b.direktiv).toBe(false);   // under 5 %: ingen direktivmarkering
    });
    it('en grupp med 30/30 och 6 % skillnad som inte är säkerställd är Följ upp', () => {
        const b = bedomSkillnad(loner(30, 94000, 0.5), loner(30, 100000, 0.5), { golv: 10 });
        expect(b.avstand).toBeCloseTo(6, 5);
        expect(b.sakerstalld).toBe(false);
        expect(b.niva).toBe('folj');
        expect(b.direktiv).toBe(true);    // markeringen följer den ojusterade skillnaden, oberoende av statusen
    });
    it('gränserna är reproducerbara (seedade ur datat)', () => {
        const kv = loner(25, 97000, 0.1), ma = loner(25, 100000, 0.1);
        expect(slumpensGranser(kv, ma)).toEqual(slumpensGranser(kv, ma));
    });
});

describe('likaArbeteGrupper: yrkesgruppernas status', () => {
    const rader = [
        ...yrke('Liten', loner(18, 92000, 0.15), loner(2, 100000, 0.15)),
        ...yrke('Säker', loner(30, 96000, 0.02), loner(30, 100000, 0.02)),
        ...yrke('Spridd', loner(30, 94000, 0.5), loner(30, 100000, 0.5)),
    ];
    const { grupper } = likaArbeteGrupper(rader, { k: 1, golv: 10 });
    const g = namn => grupper.find(x => x.yrke === namn);
    it('ett kön under golvet ger Går ej att bedöma', () => {
        expect(g('Liten').niva).toBe('ejbedomd');
        expect(g('Liten').flaggad).toBe(false);
    });
    it('flaggad är detsamma som Värt att granska', () => {
        expect(g('Säker').niva).toBe('granska');
        expect(g('Säker').flaggad).toBe(true);
        expect(g('Spridd').niva).toBe('folj');
        expect(g('Spridd').flaggad).toBe(false);
    });
    it('direktivmarkeringen följer den ojusterade medianskillnaden', () => {
        expect(g('Spridd').direktiv).toBe(true);
        expect(g('Säker').direktiv).toBe(false);
        expect(g('Liten').direktiv).toBe(true);   // 8 %: markeringen är ingen bedömning och kräver ingen prövning
    });
    it('stabiliteten prövas mot statusens storleksgräns (3 %), inte mot 5 %', () => {
        expect(g('Säker').stabilitet).toBeTruthy();
        const kort = stabilitetKort(g('Säker').stabilitet, 1);
        expect(kort).not.toMatch(/5 %/);
        expect(stabilitetKort({ niva: 'stabil', provadeMax: 2, begransad: null }, 5)).toMatch(/minst 3 %/);
    });
    it('rapportens avsnitt listar Värt att granska och har direktivkolumnen', () => {
        const b = avsnittBlock('lika', { grupper, utelamnade: [] }, { k: 1 });
        const text = JSON.stringify(b);
        expect(text).toMatch(/värda att granska/);
        expect(text).not.toMatch(/över 5 %/);
        expect(b.tabell.rubriker).toContain(DIREKTIV_KOLUMN);
        expect(b.tabell.rader.map(r => r[0])).toEqual(['Säker']);
    });
});

describe('direktivmarkeringen', () => {
    it('är minst 5 % på kvoten (kvinnors median i % av mäns)', () => {
        expect(direktivMarkering(95)).toBe(true);
        expect(direktivMarkering(95.01)).toBe(false);
        expect(direktivMarkering(106)).toBe(true);
        expect(direktivMarkering(null)).toBe(false);
    });
    it('kolumnen heter efter den ojusterade löneskillnaden', () => {
        expect(DIREKTIV_KOLUMN).toBe('Ojusterad löneskillnad ≥ 5 %');
    });
    it('verktygstipset säger att markeringen inte är en bedömning', () => {
        expect(DIREKTIV_TIPS).toMatch(/minst 5 %/);
        expect(DIREKTIV_TIPS).toMatch(/inte en bedömning/);
    });
    it('saknas på regressionens tal: per-BAS-signalen bygger på 3 % och bär ingen markering', () => {
        const s = perBasSignal(4, true, true);
        expect(s).toEqual({ niva: 'titta' });
        expect(perBasSignal(2, true, true).niva).toBe('dokumentera');
        expect(perBasSignal(8, false, true).niva).toBe('osakert');
        expect(perBasSignal(8, false, false).niva).toBe('inget');
        expect('direktiv' in s).toBe(false);
    });
});

describe('ingen färg på storleken ensam i appen', () => {
    // Den gamla gapKlass i livscykeln färgade nyckeltalen rött över 5 % och gult över 2 %, på storleken ensam. En
    // jämförelse med 5 % som direkt väljer en färgklass (fg-, farg-, ar-, bricka-, bg-, f-) är samma fel.
    const MONSTER = /Math\.abs\([^)]*\)\s*>=?\s*5(?:\.0+)?\s*\?\s*['"`](?:fg|farg|ar|bricka|bg|f)-[\w-]+/;
    const appDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app');
    it('ingen fil under src/app/ (utom spegeln) sätter en färgklass på |skillnad| > 5', () => {
        const traffar = readdirSync(appDir).filter(f => f.endsWith('.js') && f !== '09-lib-speglar.js')
            .flatMap(f => readFileSync(join(appDir, f), 'utf8').split('\n')
                .map((rad, i) => (MONSTER.test(rad) ? `${f}:${i + 1}: ${rad.trim()}` : null)).filter(Boolean));
        expect(traffar).toEqual([]);
    });
    it('mönstret fäller den gamla gapKlass', () => {
        expect(MONSTER.test("const gapKlass = (g) => Math.abs(g) > 5 ? 'fg-kritisk' : Math.abs(g) > 2 ? 'fg-varning' : 'fg-ok';")).toBe(true);
    });
});

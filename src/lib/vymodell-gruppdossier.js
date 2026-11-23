// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — vymodellen för gruppdossiern, "En grupp, en sida" (ADR-99): det verktyget redan vet om en
 * grupp (AID-kod i BAS-intervall, ADR-89) på ett ställe. Grupperna som får öppnas, nyckeltalen, den ojusterade
 * löneskillnaden med KI och räkneexemplet i kronor per år, antalet per ansvarsgrupp, läget mot ställningstagandet, paren
 * i likvärdigt arbete och jämförelsestatistiken räknas här, med tröskeln som argument. Det som räknas i andra flikar
 * (den åldersrensade skillnaden per BAS-intervall, prioriteringen och dess frågor att undersöka) kommer som argument.
 * Ritfunktionen i src/app/80-gruppdossier.js ritar bara det den får.
 */
import { aidAvYrke, namnrader } from './aid.js';
import { talformat } from './figur.js';
import { statistikFor } from './jamforelse.js';
import { arKvinna, arMan } from './kon.js';
import { parForRedovisning } from './ktroskel.js';
import { antalMotBand, gruppMotBand } from './lonepolitik.js';
import { medianKvotKIGiltiga } from './osakerhet.js';
import { arsbeloppMening } from './prioritering.js';
import { skrKvinnoandel } from './skrreferens.js';
import { kvantil, median } from './stat.js';
import { konsMedianer } from './struktur.js';

/**
 * Grupperna som får öppnas i dossiern: AID-koden i BAS-intervallet, bara rader med lön och BAS-intervall, minst k
 * personer, störst först. Namnet ur texten på flest av gruppens rader (namnrader, ADR-89).
 * @param {any[]} rader
 * @param {number} k
 * @returns {Array<{key:string, aid:string, bas:any, yrke:string, rows:any[]}>}
 */
export function gruppdossierGrupper(rader, k) {
    const map = new Map();
    const giltiga = rader.filter(r => r.lon > 0 && r.bas);
    const namnrad = namnrader(giltiga, r => aidAvYrke(r.yrke) + '|' + r.bas);
    giltiga.forEach(r => {
        const aid = aidAvYrke(r.yrke), key = aid + '|' + r.bas;
        if (!map.has(key)) map.set(key, { key, aid, bas: r.bas, yrke: namnrad.get(key).yrke, rows: [] });
        map.get(key).rows.push(r);
    });
    return [...map.values()].filter(g => g.rows.length >= k).sort((a, b) => b.rows.length - a.rows.length);
}

/**
 * Vymodellen för en grupp ur gruppdossierGrupper.
 * - `gap`: kvinnors median i procent av mäns, medianerna, bootstrap-KI:t (inte med `ki: false`) och räkneexemplet i
 *   kronor per år med prioriteringens kostnadsinställningar, bara när båda könen når k; annars null.
 * - `ansvar`: antal kvinnor och män med ledningsansvar och särskilt uppdrag (aldrig lön per ansvarsgrupp), när
 *   lönefilen har ansvarskoden.
 * - `band`, `compliance`: gruppens median i ställningstagandets spann och antalet under P10 och över P90.
 * - `lvAsSubject`, `lvAsComparator`: paren i likvärdigt arbete där gruppen är det kvinnodominerade yrket respektive
 *   jämförelseyrket; par där den andra gruppen är under k redovisas inte och räknas i `lvUtelamnade`.
 * @param {{key:string, aid:string, bas:any, yrke:string, rows:any[]}} g
 * @param {{k:number, ki?:boolean, kostnad?:any, referens?:any, referensNiva?:string|null, par?:any[], statistik?:any[],
 *   skrDel?:string, justerat?:any, prio?:any, forslag?:any[]}} val
 *   kostnad: prioriteringens kostnadsinställningar; referens och referensNiva: ställningstagandets rad för gruppen och
 *   dess nivå i ord; par: alla par i likvärdigt arbete; skrDel: delen av den nationella statistiken; justerat: den
 *   åldersrensade skillnaden för gruppens BAS-intervall; prio och forslag: gruppens post i prioriteringen och frågorna
 *   att undersöka
 */
export function vymodellGruppdossier(g, { k, ki = true, kostnad, referens = null, referensNiva = null, par = [], statistik = [],
    skrDel, justerat = null, prio = null, forslag = [] }) {
    const lons = g.rows.map(r => r.lon);
    const kv = g.rows.filter(r => arKvinna(r)), ma = g.rows.filter(r => arMan(r));
    const kvLons = kv.map(r => r.lon), maLons = ma.map(r => r.lon);

    /** @type {any} */ let gap = null;
    const km = konsMedianer(g.rows, { k });
    if (km.konOk) {
        gap = { pct: km.kvotPct, medKv: km.medKv, medMa: km.medMa,
            ci: ki ? medianKvotKIGiltiga(kvLons, maLons) : null,
            arsbelopp: arsbeloppMening({ medKv: km.medKv, medMa: km.medMa, nKv: kvLons.length }, kostnad, v => talformat(v, 'kr')) };
    }

    /** @type {any} */ let ansvar = null;
    if (g.rows.some(r => r.ansvarsgrupp)) {
        ansvar = {};
        for (const grupp of ['ledning', 'uppdrag']) {
            ansvar[grupp] = { kv: kv.filter(r => r.ansvarsgrupp === grupp).length, ma: ma.filter(r => r.ansvarsgrupp === grupp).length };
        }
    }

    const gruppens = par.filter(p => (p.kvAid === g.aid && p.kvBas === g.bas) || (p.maAid === g.aid && p.maBas === g.bas));
    const { par: redovisade, utelamnade } = parForRedovisning(gruppens, k);

    return {
        key: g.key, aid: g.aid, bas: g.bas, yrke: g.yrke,
        n: g.rows.length, nKv: kv.length, nMa: ma.length,
        median: median(lons), p10: kvantil(lons, 0.10), p90: kvantil(lons, 0.90),
        gap, adjusted: justerat, ansvar, skr: skrKvinnoandel(g.aid, { del: skrDel }),
        pol: referens, polLevel: referensNiva, band: referens ? gruppMotBand(g.rows, referens) : null,
        compliance: referens ? antalMotBand(g.rows, referens) : null,
        lvAsSubject: redovisade.filter(p => p.kvAid === g.aid && p.kvBas === g.bas),
        lvAsComparator: redovisade.filter(p => p.maAid === g.aid && p.maBas === g.bas), lvUtelamnade: utelamnade,
        bench: statistikFor(statistik, g.aid, g.bas)?.rad || null, prio, suggestions: forslag
    };
}

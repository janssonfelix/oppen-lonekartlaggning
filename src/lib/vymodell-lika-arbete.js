// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — vymodellen för fliken Lika arbete (ADR-99): tabellen per AID-kod och BAS-intervall med
 * status, underrader per ansvarsgrupp och noterna, och trattdiagrammets underlag. Allt som räknas, maskeras och
 * bedöms står här, med tröskeln och inställningarna som argument; ritfunktionen i src/app/41-lika-arbete.js
 * (ritaLikaArbete) ritar bara det den får.
 */
import { aidAvRad } from './aid.js';
import { dominans } from './aidbas.js';
import { ansvarsUnderrader } from './ansvar.js';
import { personOrd } from './namn.js';
import { gruppMde, trattUnderlag } from './osakerhet.js';
import { gruppMedBas, likaArbeteGrupper, stabilitetKort } from './rapportunderlag.js';
import { skrKvinnoandel } from './skrreferens.js';
import { konsMedianer } from './struktur.js';

/**
 * Underraderna per ansvarsgrupp under en grupp, med samma k-regler som gruppens rad (ansvarsUnderrader i ansvar.js),
 * eller null när gruppen har färre än två ansvarsgrupper. `utanLedning` är kvinnors lön i % av mäns för de övriga
 * när gruppen har ledningsansvar och båda könen där når k, annars null.
 * @param {any[]} rader  gruppens rader
 * @param {number} k
 */
export function ansvarFor(rader, k) {
    if (!rader.some(x => x.ansvarsgrupp)) return null;
    const grupper = ansvarsUnderrader(rader, { k });
    if (grupper.length < 2) return null;
    let utanLedning = /** @type {number|null} */ (null);
    if (grupper.some(u => u.grupp === 'ledning')) {
        const ovriga = konsMedianer(rader.filter(x => x.ansvarsgrupp && x.ansvarsgrupp !== 'ledning'), { k });
        if (ovriga.konOk) utanLedning = ovriga.kvotPct;
    }
    return { grupper, utanLedning };
}

/** Statusens förklaring i ord (verktygstipset), efter nivån och om skillnaden är säkerställd. */
export function statusTips(niva, sakerstalld, golv) {
    if (niva === 'ejbedomd') return `Går ej att bedöma: ett kön har färre än ${golv} ${personOrd(golv)}, för få för att pröva skillnaden`;
    if (niva === 'granska') return 'Skillnaden är statistiskt säkerställd (utanför slumpens gränser för gruppen) och minst 3 % (verktygets storleksgräns)';
    if (niva === 'folj') return sakerstalld ? 'Skillnaden är statistiskt säkerställd men under 3 % (verktygets storleksgräns)' : 'Skillnaden är minst 3 % men inte statistiskt säkerställd (inom slumpens gränser för gruppen)';
    return 'Skillnaden är under 3 % och inte statistiskt säkerställd';
}

/**
 * Vymodellen, eller null utan underlag. Grupperna och trattens underlag är dyra (omkastning); appen räknar dem en gång
 * per underlag och tröskel och skickar dem som `lika` och `tratt`, annars räknas de här.
 * @param {any[]} rader
 * @param {{k:number, golv:number, sigma?:number, dominansDefinition?:'do'|'scb', dominansGrans?:number, skrDel?:string,
 *   lika?:any, tratt?:any}} val
 *   sigma: spridningen för gruppens minsta upptäckbara skillnad (styrkan); dominansDefinition och dominansGrans:
 *   definitionen av kvinnodominerat (ADR-60, 72); skrDel: delen av den nationella statistiken
 */
export function vymodellLikaArbete(rader, { k, golv, sigma, dominansDefinition, dominansGrans, skrDel, lika, tratt }) {
    if (!rader.length) return null;
    const lg = lika || likaArbeteGrupper(rader, { k, golv });
    const u = tratt === undefined ? trattUnderlag(rader, k) : tratt;
    const grupper = lg.grupper.map(g => {
        const { yrke, aid, bas, nKv, nMa, tot } = g;
        const gemensamt = { yrke, aid, bas, nKv, nMa, tot,
            dominans: dominans(nKv / tot * 100, dominansDefinition, dominansGrans),
            nationellt: skrKvinnoandel(yrke, { del: skrDel }),
            // Gruppens rader är koden i BAS-intervallet, inte texten (likaArbeteGrupper): alla stavningar av etiketten.
            ansvar: ansvarFor(rader.filter(x => aidAvRad(x) === aid && String(x.bas) === bas), k) };
        if (g.samladMedian) return { ...gemensamt, medTot: g.medTot, gap: 0, samladMedian: true };
        // Styrkan: gruppens minsta upptäckbara skillnad. Jämförelsen är mot |gap − 100|, där gap redan är avståndet
        // från lika lön, som i tabellen före vymodellen.
        const mde = gruppMde(nKv, nMa, sigma);
        return { ...gemensamt, medKv: g.medKv, medMa: g.medMa, gap: g.gapPct, kvot: g.kvot * 100, samladMedian: false,
            niva: g.niva, direktiv: g.direktiv, tips: statusTips(g.niva, g.sakerstalld, golv),
            stabilitet: g.flaggad && g.stabilitet ? stabilitetKort(g.stabilitet, k) : null,
            lagStyrka: mde && (mde.tooSmall || mde.mdePct > Math.abs(g.gapPct - 100)) ? mde : null };
    });
    return {
        grupper,
        utelamnade: lg.utelamnade,
        samlade: lg.grupper.filter(g => g.samladMedian).map(gruppMedBas),
        ejJamforbara: lg.ejJamforbara,
        skor: lg.grupper.some(g => g.flaggad),
        // Med färre än två grupper finns inget att jämföra: trattens kort visas inte.
        tratt: u && u.punkter.length >= 2 ? u : null
    };
}

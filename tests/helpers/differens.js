// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Differensprovet (S4, `docs/utveckling/k-troskeln.md`): ett lönemått för en grupp under tröskeln får inte gå att
 * räkna fram ur summorna i samma export. Hjälparen räknar fram det som en total och de visade delarna lämnar över,
 * och bygger påhittade underlag där exakt en grupp ligger under tröskeln. Allt är deterministiskt: samma frö ger samma
 * underlag, så att ett prov inte växlar mellan grönt och rött.
 */

/**
 * Det som totalen lämnar över när de visade delarna dras ifrån: antal och medel för resten.
 * n_ut = n_tot − Σ n_i och medel_ut = (n_tot · m_tot − Σ n_i · m_i) / n_ut. Null när inget blir över eller ett tal
 * saknas (ett utelämnat mått går inte att räkna med).
 * @param {{n:number, medel:number|null}} total
 * @param {{n:number, medel:number|null}[]} delar
 * @returns {{n:number, medel:number}|null}
 */
export function rest(total, delar) {
    if (!total || typeof total.medel !== 'number' || !isFinite(total.medel)) return null;
    let n = total.n, summa = total.n * total.medel;
    for (const d of delar) {
        if (typeof d.medel !== 'number' || !isFinite(d.medel)) return null;
        n -= d.n;
        summa -= d.n * d.medel;
    }
    return n > 0 ? { n, medel: summa / n } : null;
}

/** Hela kronor, som exporterna skriver lönemått (Excel `Math.round`, Word och PDF `svKr`). */
export const heltal = v => (typeof v === 'number' && isFinite(v) ? Math.round(v) : v);

/**
 * Gränsen för "härledd": inom ± 1 % av gruppens sanna medellön. En procent är mindre än ett lönesteg i de flesta
 * lönesättningar och mindre än skillnaden mellan två grannar i en lönelista; den som får ett tal så nära vet i praktiken
 * lönen. Ett prov som missar med mer än så räknas som att härledningen misslyckas.
 */
export const GRANS = 0.01;

/** Relativ avvikelse mellan det härledda och det sanna; Infinity när inget gick att härleda. */
export function avvikelse(harlett, sann) {
    return typeof harlett === 'number' && isFinite(harlett) ? Math.abs(harlett - sann) / Math.abs(sann) : Infinity;
}

/** Sant när det härledda ligger inom gränsen. */
export const harlett = (varde, sann, grans = GRANS) => avvikelse(varde, sann) <= grans;

/**
 * En enkel seedad generator (mulberry32): tal i [0, 1), samma följd för samma frö.
 * @param {number} fro
 */
export function slump(fro) {
    let a = fro >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const _rad = (falt, kon, lon, alder) => {
    const aid = falt.aid ?? '1501';
    return { bas: 'A', yrke: `${aid} Yrke ${aid}`, yrkeLabel: `Yrke ${aid}`, ...falt, aid, kon, lon, alder };
};

/**
 * Ett påhittat underlag med `antal` personer där exakt en grupp ligger under tröskeln.
 *
 * `stora` är grupperna över tröskeln, var och en fälten den har gemensamt ({ bas, aid, kon? }); personerna fördelas
 * jämnt över dem, med varannan kvinna och varannan man när gruppen inte har ett eget kön, åldrar mellan 25 och 64 och
 * löner mellan 30 000 och 48 000 kr (en nivå per grupp plus slump, i steg om 10 kr). `liten` är den lilla gruppens fält
 * och `nLiten` dess storlek; dess löner ligger symmetriskt kring `lonLiten` i steg om 200 kr, så att dess medellön är
 * exakt `lonLiten`. Den lilla gruppen är kvinnor om inte `liten.kon` säger annat.
 *
 * @param {{antal:number, stora:Record<string, any>[], liten:Record<string, any>, nLiten:number, lonLiten?:number,
 *          fro?:number, k?:number, alderLiten?:number}} opt
 * @returns {{rader:any[], liten:{n:number, medel:number}}}
 */
export function underlagMedEnLitenGrupp({ antal, stora, liten, nLiten, lonLiten = 95000, fro = 1, k = 10, alderLiten = 45 }) {
    if (nLiten >= k) throw new Error(`den lilla gruppen ska vara under tröskeln (${nLiten} ≥ ${k})`);
    const s = slump(fro);
    const ovriga = antal - nLiten;
    const rader = [];
    stora.forEach((g, gi) => {
        const n = Math.floor(ovriga / stora.length) + (gi < ovriga % stora.length ? 1 : 0);
        if (n < k) throw new Error(`gruppen ${JSON.stringify(g)} blir under tröskeln (${n})`);
        for (let i = 0; i < n; i++) {
            const kon = g.kon ?? (i % 2 ? 'man' : 'kvinna');
            const lon = Math.round((30000 + gi * 2500 + s() * 8000) / 10) * 10;
            rader.push(_rad(g, kon, lon, 25 + Math.floor(s() * 40)));
        }
    });
    const lonerLiten = Array.from({ length: nLiten }, (_, i) => lonLiten + (i - (nLiten - 1) / 2) * 200);
    lonerLiten.forEach((lon, i) => rader.push(_rad(liten, liten.kon ?? 'kvinna', lon, alderLiten + i)));
    return { rader, liten: { n: nLiten, medel: lonerLiten.reduce((a, b) => a + b, 0) / nLiten } };
}

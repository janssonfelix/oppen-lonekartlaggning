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

/**
 * Den som läser exporten och räknar med allt som står där samtidigt: ett ekvationssystem i stället för en differens.
 *
 * Det som skrivs ut (medellöner, delar, poster) är linjärt i medellönerna i cellerna — en cell är personerna med samma
 * värden på uppdelningens fält och samma kön — så länge antalen per cell är desamma. Antalen räknas som kända (ADR-70:
 * de står i samma export eller går att få fram). Hjälparen tar fram sambandet utan att känna till metoden: den höjer
 * lönen med samma belopp för alla i en cell i taget och läser hur varje utskrivet tal ändras. Det ger en matris J med en
 * rad per utskrivet tal och en kolumn per cell, och utskrivet = J · medellönerna.
 *
 * Ett mål är ett vägt medel över celler (`mal`: cell → vikt, vikterna summerar till 1). Det går att räkna fram ur det
 * som skrivs ut precis när målet är en linjärkombination av J:s rader, alltså när J^T · y = mål har en lösning; då är
 * målets värde y · utskrivet. Hjälparen löser systemet (Gausselimination med pivotering) och ger värdet, räknat på de
 * utskrivna talen avrundade som exporten avrundar eller oavrundade, eller null när målet inte är bestämt.
 *
 * @param {{rader:any[], cell:(r:any)=>string, utskrivet:(rader:any[])=>number[], mal:Record<string, number>}} opt
 *   `cell` ger radens cell (med kön); `utskrivet` ger de utskrivna talen i en fast ordning; `mal` målet.
 * @returns {(avrunda:boolean) => number|null}
 */
export function harledLinjart({ rader, cell, utskrivet, mal }) {
    const DELTA = 10000;
    const celler = [...new Set(rader.map(cell))].sort();
    const bas = utskrivet(rader);
    // Kolumn per cell: hur de utskrivna talen ändras när cellens medellön höjs med ett.
    const kolumner = celler.map(c => {
        const u = utskrivet(rader.map(r => (cell(r) === c ? { ...r, lon: r.lon + DELTA } : r)));
        return u.map((v, i) => (v - bas[i]) / DELTA);
    });
    const m = bas.length, p = celler.length;
    // Raderna skalas till största belopp 1, så att toleransen betyder samma sak för alla.
    const skala = Array.from({ length: m }, (_, i) => Math.max(1e-300, ...kolumner.map(k => Math.abs(k[i]))));
    // Systemet J^T · y = mål: p ekvationer (en per cell), m okända (en per utskrivet tal).
    const A = celler.map((c, j) => [...kolumner[j].map((v, i) => v / skala[i]), mal[c] || 0]);
    const TOL = 1e-7;
    const pivot = [];
    let rad = 0;
    for (let kol = 0; kol < m && rad < p; kol++) {
        let bast = rad;
        for (let r = rad + 1; r < p; r++) if (Math.abs(A[r][kol]) > Math.abs(A[bast][kol])) bast = r;
        if (Math.abs(A[bast][kol]) < TOL) continue;
        [A[rad], A[bast]] = [A[bast], A[rad]];
        for (let r = 0; r < p; r++) {
            if (r === rad) continue;
            const f = A[r][kol] / A[rad][kol];
            if (f) for (let c = kol; c <= m; c++) A[r][c] -= f * A[rad][c];
        }
        pivot.push([rad, kol]);
        rad++;
    }
    // Olöst: en ekvation 0 = mål ≠ 0 betyder att målet inte är en kombination av det som skrivs ut.
    for (let r = rad; r < p; r++) if (Math.abs(A[r][m]) > 1e-6) return () => null;
    const y = new Array(m).fill(0);
    for (const [r, kol] of pivot) y[kol] = A[r][m] / A[r][kol] / skala[kol];
    return avrunda => bas.reduce((s, v, i) => s + y[i] * (avrunda ? heltal(v) : v), 0);
}

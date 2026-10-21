// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Helt syntetisk personalfil för tester, prestandamätning och bidragsgivare. Ingen källfil
// och ingen slump mellan körningar: samma n ger alltid samma fil. Yrken och lönenivåer är
// påhittade och speglar ingen verklig organisation.

const BAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
/** @type {Array<[string, string, number]>} */
const YRKEN = [
    ['207024', 'Vårdbiträde', 28000], ['206017', 'Sjuksköterska', 36000],
    ['402010', 'Förskollärare', 31000], ['401011', 'Lärare grundskola', 38000],
    ['502010', 'Systemutvecklare', 44000], ['151010', 'Handläggare', 34000],
    ['521015', 'Vaktmästare', 27000], ['151011', 'Ekonom', 40000]
];

/** Bygger en CSV (semikolon) med rubrikrad och n personer. */
export function byggTestCsv(n, frö = 20260921) {
    const rnd = () => { frö = (frö * 1103515245 + 12345) & 0x7fffffff; return frö / 0x7fffffff; };
    const rader = ['Ansvar;BAS;AID-etikett;Månadslön;Ålder;Kön'];
    for (let i = 0; i < n; i++) {
        const [aid, namn, basLon] = YRKEN[(rnd() * YRKEN.length) | 0];
        const bas = BAS[(rnd() * BAS.length) | 0];
        const lon = Math.round(basLon * (0.8 + rnd() * 0.5));
        const alder = 22 + ((rnd() * 45) | 0);
        const kon = rnd() < 0.62 ? 'Kvinna' : 'Man';
        rader.push(`${10000000 + (i % 20)};${bas};${aid} ${namn};${lon};${alder};${kon}`);
    }
    return rader.join('\n') + '\n';
}

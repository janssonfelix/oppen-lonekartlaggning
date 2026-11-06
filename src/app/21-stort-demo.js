// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Stort demo: 7 000 påhittade personer ----
// Bredvid det lilla demot (20-demodata-diagnostik.js, 260 personer), som självdiagnostiken och testsviten bygger på
// och som lämnas orört. Det stora visar verktyget i verklig storlek, en mindre kommun eller en stor verksamhet, utan
// riktig data. Allt är påhittat: inga personer, inga namn, ingen verklig organisation.
//
// Yrkena har riktiga koder ur SKR:s etikettlista (så att kontrollen av AID-kodningen är grön) och korta namn, som i
// det lilla demot. Varje yrke hör till ett eller två BAS-intervall och har en egen könsfördelning och storlek.
// Lön = nivå per BAS + yrkestillägg, gånger en konkav ålderseffekt, gånger brus. Inlagt finns:
//   - ett oförklarat gap för kvinnor på 2,5–4 % i fyra yrken (Lärare gymnasieskola, Socialsekreterare,
//     Handläggare, Ekonom);
//   - likvärdigt arbete: Drifttekniker (mansdominerat) i BAS C med högre lön än Undersköterska (kvinnodominerat)
//     i samma intervall;
//   - män något oftare och äldre oftare i det högre av yrkets två intervall (struktur, inte lön för lika arbete);
//   - små grupper: tre yrken under tio personer och några yrken där ett kön är färre än tio, så att
//     k-anonymitetens maskering syns i exporterna.
// Ansvarskoderna följer det lilla demots regel (ledningsansvar, särskilt uppdrag, förstelärare); cheferna har
// ledningsansvar. Ansvarskoderna påverkar inte lönerna.

const STORT_DEMO_ANTAL = 7000;
const _SD_BAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
// [AID, namn, antal, andel kvinnor, BAS-intervall, yrkestillägg (kr), medelålder, gap för kvinnor, ansvarskod för chefer]
// Undersköterskornas antal räknas fram så att summan blir 7 000.
/** @type {ReadonlyArray<[string, string, number|null, number, string[], number, number, number?, string[]?]>} */
const _SD_YRKEN = Object.freeze([
    ['207011', 'Undersköterska', null, 0.88, ['B', 'C'], -800, 45],
    ['207024', 'Vårdbiträde', 380, 0.84, ['A', 'B'], 0, 42],
    ['351040', 'Personlig assistent', 460, 0.74, ['A', 'B'], -500, 36],
    ['403010', 'Barnskötare', 540, 0.92, ['B'], 300, 44],
    ['402010', 'Förskollärare', 520, 0.95, ['D'], 0, 46],
    ['401011', 'Lärare grundskola', 800, 0.74, ['D', 'E'], 500, 45],
    ['401012', 'Lärare gymnasieskola', 260, 0.55, ['E'], 800, 47, -0.025],
    ['206017', 'Sjuksköterska', 460, 0.90, ['E', 'F'], 0, 43],
    ['301010', 'Arbetsterapeut', 62, 0.89, ['D'], 0, 42],
    ['301011', 'Fysioterapeut', 48, 0.70, ['D'], 300, 41],
    ['351008', 'Socialsekreterare', 270, 0.86, ['D', 'E'], 400, 40, -0.03],
    ['151010', 'Handläggare', 450, 0.58, ['D', 'E'], 500, 45, -0.035],
    ['151011', 'Ekonom', 130, 0.66, ['E', 'F'], 600, 44, -0.04],
    ['151012', 'HR-specialist', 85, 0.82, ['E', 'F'], 400, 44],
    ['152010', 'Administratör', 380, 0.86, ['B', 'C'], 0, 47],
    ['502010', 'Systemutvecklare', 95, 0.21, ['E', 'F'], 2500, 41],
    ['503012', 'Drifttekniker', 115, 0.14, ['C'], 4200, 44],
    ['521015', 'Vaktmästare', 140, 0.11, ['B'], 900, 49],
    ['521011', 'Fastighetsskötare', 72, 0.08, ['C'], 1500, 48],
    ['601010', 'Kock', 165, 0.68, ['B'], 0, 44],
    ['651010', 'Lokalvårdare', 248, 0.79, ['A'], 0, 46],
    ['452011', 'Fritidsledare', 150, 0.46, ['B', 'C'], 0, 34],
    ['151020', 'Nämndsekreterare', 40, 0.78, ['E'], 0, 46],
    ['502011', 'GIS-ingenjör', 9, 0.33, ['F'], 1500, 42],
    ['151018', 'Jurist', 8, 0.62, ['G'], 1000, 44],
    ['301014', 'Logoped', 6, 0.83, ['E'], 0, 41],
    ['103511', 'Enhetschef äldreomsorg', 110, 0.80, ['F', 'G'], 0, 49, 0, ['C']],
    ['104011', 'Rektor', 45, 0.68, ['G', 'H'], 0, 51, 0, ['C']],
    ['101015', 'Verksamhetschef', 40, 0.55, ['H', 'I'], 0, 53, 0, ['C']],
    ['101010', 'Direktör', 12, 0.50, ['J', 'K'], 0, 55, 0, ['A']],
]);

function generateStortDemo() {
    // Samma slags seedade slump som generateTestData, med ett eget frö: samma underlag vid varje anrop.
    let seed = 7000;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const rndNorm = () => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const ovriga = _SD_YRKEN.reduce((s, y) => s + (y[2] || 0), 0);
    const data = [];
    for (const [aid, namn, antal, andelKv, basLista, tillagg, medelalder, gap = 0, chefKod = null] of _SD_YRKEN) {
        const n = antal ?? STORT_DEMO_ANTAL - ovriga;
        const kvinnor = Math.round(n * andelKv);
        const yrke = `${aid} ${namn}`;
        const personer = [];
        for (let i = 0; i < n; i++) {
            const kon = i < kvinnor ? 'kvinna' : 'man';
            const alder = Math.max(20, Math.min(66, Math.round(medelalder + rndNorm() * 10)));
            // Plats i yrkets högre intervall: äldre och män hamnar där något oftare.
            const poang = rnd() - (kon === 'man' ? 0.12 : 0) - (alder - 44) * 0.008;
            personer.push({ kon, alder, poang });
        }
        // En tredjedel i det högre intervallet, när yrket har två.
        const iHogre = basLista.length > 1 ? new Set([...personer].sort((a, b) => a.poang - b.poang).slice(0, Math.round(n / 3))) : new Set();
        for (const p of personer) {
            const bas = basLista[iHogre.has(p) ? 1 : 0];
            const rang = _SD_BAS.indexOf(bas);
            const niva = 26000 + rang * 4900 + tillagg;
            const alderseffekt = 0.92 + 0.16 * (1 - Math.exp(-(p.alder - 20) / 12));   // brant tidigt, flack sent
            const konseffekt = p.kon === 'kvinna' ? 1 + gap : 1;
            const lon = Math.round(niva * alderseffekt * konseffekt * (1 + rndNorm() * 0.035));
            data.push({ bas, yrke, aid, yrkeLabel: namn, lon, alder: p.alder, kon: p.kon, ansvarskoder: chefKod ? [...chefKod] : null });
        }
    }
    // Ansvarskod (AID) för alla utom cheferna, som i det lilla demot: var 15:e man och var 30:e kvinna har
    // ledningsansvar, var 15:e lärare är förstelärare och var 30:e person har ett särskilt uppdrag.
    const raknare = { kvinna: 0, man: 0 };
    let larare = 0;
    data.forEach((r, i) => {
        if (!r.ansvarskoder) {
            const nr = ++raknare[r.kon];
            let koder = [];
            if ((r.kon === 'man' && nr % 15 === 0) || (r.kon === 'kvinna' && nr % 30 === 0)) koder = ['C'];
            else if ((r.aid === '401011' || r.aid === '401012') && ++larare % 15 === 0) koder = ['1002'];
            else if ((i + 1) % 30 === 0) koder = ['F'];
            r.ansvarskoder = koder;
        }
        r.ansvarsgrupp = _anGrupp(r.ansvarskoder);
        r.radnr = i + 2;   // som en fil med rubrik på rad 1
    });
    return data;
}

// Som det lilla demot (_lasInDemounderlag), men utan självdiagnostik: den hör till det lilla demots kända egenskaper.
function loadStortDemo() {
    if (!_lasInDemounderlag(generateStortDemo, { stort: true })) return;
    /** @type {HTMLElement} */ (document.getElementById('diagnostic-results')).style.display = 'none';   // ett tidigare litet demos diagnostik gäller inte här
    _renderDemoBanner();
    announceToScreenReader(`Stort demo inläst: ${svTal(state.data.length)} påhittade personer i ${getBasIntervals().length} BAS-intervall.`);
}
['first-run-stort-demo', 'upload-demo-stort'].forEach(id =>
    document.getElementById(id)?.addEventListener('click', loadStortDemo));

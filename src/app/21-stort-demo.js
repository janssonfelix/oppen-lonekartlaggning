// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Stort demo: 5 000 påhittade personer i 100 yrken ----
// Bredvid det lilla demot (20-demodata-diagnostik.js, 260 personer), som självdiagnostiken och testsviten bygger på
// och som lämnas orört. Det stora visar verktyget i verklig storlek, en mindre kommun eller en stor verksamhet, utan
// riktig data. Allt är påhittat: inga personer, inga namn, ingen verklig organisation.
//
// Yrkena har riktiga koder ur etikettlistan (så att kontrollen av AID-kodningen är grön) och korta namn, som i det
// lilla demot. Varje yrke hör till ett eller två BAS-intervall och har en egen storlek, könsfördelning, lönenivå per
// intervall, spridning och medelålder, så att underlaget får en verklighetstrogen form: många yrken i B–G, få chefer
// i J–K, stora och små grupper. Lön = yrkets nivå i intervallet, gånger en konkav ålderseffekt, gånger en könseffekt,
// gånger brus som ger yrkets spridning. Inlagt finns:
//   - ett oförklarat gap för kvinnor på 2,5–4 % i fyra blandade yrken (_SD_GAP);
//   - likvärdigt arbete: ett mansdominerat tekniskt yrke med högre lön än ett kvinnodominerat vårdyrke i samma
//     intervall (_SD_LIKVARDIGT);
//   - män något oftare och äldre oftare i det högre av yrkets två intervall (struktur, inte lön för lika arbete);
//   - små grupper: yrken under tio personer och yrken där ett kön är färre än tio, så att k-anonymitetens
//     maskering syns i exporterna.
// Ansvarskoderna följer det lilla demots regel (ledningsansvar, särskilt uppdrag, förstelärare); cheferna (AID som
// börjar med 10) har ledningsansvar. Ansvarskoderna påverkar inte lönerna.

const STORT_DEMO_ANTAL = 5000;
const _SD_BAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
// [AID, namn, antal, andel kvinnor, BAS-intervall (det lägre, ev. det högre), andel i det högre intervallet,
//  nivå i det lägre (kr), nivå i det högre (kr) eller null, spridning ((P90 − P10) / median), medelålder,
//  påslag i den påhittade jämförelsestatistiken]
// Antalen summerar till STORT_DEMO_ANTAL.
/** @type {ReadonlyArray<[string, string, number, number, string[], number, number, number|null, number, number, number]>} */
const _SD_YRKEN = Object.freeze([
    ['103510', 'Chef individ- och familjeomsorg', 17, 0.95, ['J'], 0.0, 58900, null, 0.20, 51, 0.20],
    ['103511', 'Enhetschef äldreomsorg', 50, 0.90, ['J'], 0.0, 55200, null, 0.36, 49, 0.09],
    ['103512', 'Enhetschef funktionsnedsättning', 25, 0.75, ['J'], 0.0, 51400, null, 0.36, 50, 0.11],
    ['104011', 'Rektor', 45, 0.80, ['J', 'K'], 0.2, 61600, 72700, 0.34, 49, 0.21],
    ['104012', 'Chef förskola och fritid', 25, 0.95, ['J'], 0.0, 59500, null, 0.29, 47, 0.11],
    ['105010', 'Chef teknik och samhällsbyggnad', 25, 0.70, ['I', 'J'], 0.7, 60700, 64900, 0.16, 45, 0.22],
    ['109090', 'Chef övrig verksamhet', 15, 0.70, ['J'], 0.0, 65900, null, 0.27, 47, 0.13],
    ['151010', 'Handläggare övergripande', 25, 0.70, ['G', 'J'], 0.4, 47500, 63800, 0.15, 44, 0.10],
    ['151011', 'Ekonom', 35, 0.65, ['F', 'G'], 0.7, 44900, 48200, 0.27, 44, 0.22],
    ['151013', 'Kommunikatör', 30, 0.75, ['F', 'G'], 0.7, 44400, 46600, 0.27, 43, 0.02],
    ['151014', 'IT-handläggare', 45, 0.25, ['G', 'H'], 0.4, 49100, 58600, 0.25, 46, 0.16],
    ['151015', 'Upphandlare', 15, 0.45, ['G', 'H'], 0.5, 39400, 47500, 0.33, 39, 0.12],
    ['151016', 'Handläggare medborgarservice', 11, 0.90, ['G'], 0.0, 43800, null, 0.40, 41, -0.01],
    ['151017', 'Miljöhandläggare', 17, 0.80, ['H'], 0.0, 49200, null, 0.33, 43, 0.08],
    ['151018', 'Jurist', 8, 1.00, ['J'], 0.0, 61400, null, 0.23, 51, 0.22],
    ['151019', 'Arkivarie', 7, 0.70, ['F'], 0.0, 40200, null, 0.29, 44, 0.10],
    ['151020', 'Nämndsekreterare', 8, 0.80, ['G'], 0.0, 52000, null, 0.29, 47, 0.19],
    ['151023', 'Handläggare socialtjänst', 40, 0.85, ['F', 'G'], 0.7, 41600, 47500, 0.30, 47, 0.19],
    ['151024', 'Handläggare skola', 40, 0.85, ['F', 'G'], 0.4, 41700, 46700, 0.41, 46, 0.21],
    ['151025', 'Trafikhandläggare', 25, 0.55, ['G', 'H'], 0.4, 47500, 49900, 0.30, 47, 0.19],
    ['151026', 'Handläggare fastighet', 15, 0.65, ['G'], 0.0, 51200, null, 0.30, 46, 0.16],
    ['151090', 'Handläggare övrigt', 40, 0.75, ['G', 'H'], 0.4, 46200, 48500, 0.31, 43, 0.22],
    ['152010', 'Administratör', 7, 0.85, ['C'], 0.0, 31200, null, 0.24, 41, 0.15],
    ['152011', 'Ekonomiadministratör', 12, 0.90, ['D'], 0.0, 34300, null, 0.21, 47, 0.12],
    ['152012', 'Löneadministratör', 30, 0.85, ['D', 'E'], 0.5, 32600, 35100, 0.28, 43, 0.14],
    ['152013', 'Administratör kommunikation', 20, 0.90, ['D'], 0.0, 33100, null, 0.20, 45, 0.19],
    ['152014', 'IT-administratör', 4, 0.75, ['C'], 0.0, 38300, null, 0.17, 48, 0.16],
    ['152015', 'Administratör socialtjänst', 85, 0.90, ['D'], 0.0, 35600, null, 0.27, 43, 0.08],
    ['152016', 'Administratör skola', 40, 0.90, ['C'], 0.0, 37800, null, 0.29, 43, 0.20],
    ['152020', 'Administratör teknik och fastighet', 8, 0.85, ['C'], 0.0, 32500, null, 0.39, 39, 0.20],
    ['152090', 'Administratör övrigt', 25, 0.75, ['C', 'D'], 0.5, 34200, 38400, 0.25, 42, 0.15],
    ['204510', 'Psykolog', 14, 0.85, ['G'], 0.0, 48400, null, 0.34, 42, 0.15],
    ['206011', 'Distriktssköterska', 9, 1.00, ['H'], 0.0, 43200, null, 0.39, 48, 0.10],
    ['206014', 'Sjuksköterska äldreomsorg', 10, 1.00, ['H'], 0.0, 50000, null, 0.21, 51, 0.10],
    ['206019', 'Skolsköterska', 25, 1.00, ['G'], 0.0, 46600, null, 0.22, 47, 0.20],
    ['206090', 'Sjuksköterska', 80, 0.85, ['G'], 0.0, 40700, null, 0.37, 44, 0.09],
    ['207008', 'Specialistundersköterska', 25, 1.00, ['E'], 0.0, 37900, null, 0.24, 45, 0.19],
    ['207009', 'Undersköterska hemtjänst', 230, 0.75, ['D'], 0.0, 33700, null, 0.32, 42, 0.10],
    ['207011', 'Undersköterska särskilt boende', 401, 0.85, ['D'], 0.0, 33200, null, 0.32, 44, 0.09],
    ['207024', 'Vårdbiträde särskilt boende', 45, 0.80, ['B'], 0.0, 29000, null, 0.33, 39, 0.15],
    ['207029', 'Vårdbiträde hemtjänst', 35, 0.70, ['B'], 0.0, 29600, null, 0.25, 37, 0.20],
    ['207090', 'Biträdesarbete övrigt', 105, 0.65, ['B'], 0.0, 27300, null, 0.26, 37, 0.14],
    ['301010', 'Arbetsterapeut', 25, 0.80, ['G'], 0.0, 40600, null, 0.20, 43, 0.06],
    ['301011', 'Fysioterapeut', 20, 0.85, ['G'], 0.0, 44000, null, 0.33, 43, 0.12],
    ['301012', 'Arbetsterapibiträde', 25, 0.80, ['D', 'E'], 0.4, 36000, 37800, 0.23, 43, 0.15],
    ['301014', 'Logoped', 4, 1.00, ['F'], 0.0, 43300, null, 0.08, 46, 0.15],
    ['351008', 'Socialsekreterare barn och unga', 65, 0.95, ['H'], 0.0, 39600, null, 0.39, 45, 0.15],
    ['351009', 'Socialsekreterare ekonomiskt bistånd', 60, 0.90, ['G'], 0.0, 40500, null, 0.39, 43, 0.19],
    ['351010', 'Socialsekreterare övrigt', 145, 0.80, ['G', 'H'], 0.3, 42600, 44900, 0.30, 45, 0.12],
    ['351011', 'Fältsekreterare', 9, 0.70, ['F'], 0.0, 36200, null, 0.23, 46, 0.17],
    ['351012', 'Socialsekreterare vuxna och LSS', 75, 0.85, ['G'], 0.0, 41700, null, 0.32, 46, 0.11],
    ['351015', 'Behandlingsassistent', 30, 0.70, ['E'], 0.0, 35500, null, 0.36, 43, 0.10],
    ['351016', 'Arbetsmarknadskonsulent', 14, 0.75, ['F'], 0.0, 41000, null, 0.21, 46, 0.06],
    ['351031', 'Stödassistent gruppboende', 265, 0.75, ['D'], 0.0, 32300, null, 0.31, 43, 0.18],
    ['351032', 'Stödassistent dagverksamhet', 60, 0.75, ['D'], 0.0, 33700, null, 0.24, 43, 0.13],
    ['351033', 'Stödbiträde', 55, 0.65, ['B'], 0.0, 28100, null, 0.29, 37, 0.15],
    ['351040', 'Personlig assistent', 30, 0.65, ['C'], 0.0, 30400, null, 0.29, 43, -0.01],
    ['352010', 'Kurator', 25, 0.80, ['G'], 0.0, 46100, null, 0.27, 46, 0.13],
    ['352090', 'Kurativt arbete övrigt', 4, 1.00, ['G'], 0.0, 39900, null, 0.24, 46, 0.14],
    ['401009', 'Lärare grundskola F-3', 180, 0.95, ['F'], 0.0, 42100, null, 0.33, 43, 0.17],
    ['401010', 'Lärare grundskola 4-6', 150, 0.70, ['F', 'G'], 0.2, 43500, 53700, 0.38, 45, 0.13],
    ['401011', 'Lärare grundskola 7-9', 120, 0.65, ['F'], 0.0, 44500, null, 0.36, 45, 0.16],
    ['401012', 'Lärare gymnasieskola', 100, 0.65, ['G'], 0.0, 47000, null, 0.32, 45, 0.22],
    ['401013', 'Yrkeslärare gymnasieskola', 30, 0.55, ['G'], 0.0, 44600, null, 0.31, 45, 0.14],
    ['401017', 'Specialpedagog', 45, 0.90, ['G'], 0.0, 50300, null, 0.27, 44, -0.01],
    ['401018', 'SFI-lärare', 6, 0.85, ['G'], 0.0, 41800, null, 0.15, 49, 0.20],
    ['402010', 'Förskollärare', 295, 0.95, ['F'], 0.0, 38600, null, 0.34, 44, 0.15],
    ['402011', 'Lärare i fritidshem', 70, 0.60, ['F'], 0.0, 39300, null, 0.33, 45, 0.15],
    ['402090', 'Lärararbete övrigt', 15, 0.80, ['E', 'F'], 0.4, 37700, 44500, 0.42, 43, 0.15],
    ['403010', 'Barnskötare', 355, 0.95, ['C'], 0.0, 29600, null, 0.36, 41, 0.13],
    ['403011', 'Dagbarnvårdare', 7, 1.00, ['D'], 0.0, 33600, null, 0.14, 44, 0.18],
    ['403013', 'Instruktör', 13, 0.65, ['E'], 0.0, 36200, null, 0.55, 37, 0.17],
    ['403014', 'Studie- och yrkesvägledare', 16, 0.75, ['F'], 0.0, 40000, null, 0.36, 44, 0.22],
    ['403015', 'Lärarassistent', 20, 0.60, ['C'], 0.0, 33400, null, 0.31, 42, 0.18],
    ['403016', 'Elevassistent', 195, 0.70, ['C', 'D'], 0.6, 30700, 32200, 0.30, 42, 0.21],
    ['403090', 'Skolarbete övrigt', 12, 0.50, ['E'], 0.0, 34000, null, 0.26, 45, 0.22],
    ['451011', 'Kulturskolelärare', 25, 0.75, ['E', 'F'], 0.3, 37600, 39500, 0.30, 44, 0.20],
    ['451014', 'Museiarbete', 15, 0.70, ['C'], 0.0, 28000, null, 0.48, 35, 0.15],
    ['451015', 'Bibliotekarie', 35, 0.75, ['F'], 0.0, 37000, null, 0.26, 42, 0.09],
    ['451016', 'Biblioteksassistent', 4, 1.00, ['B'], 0.0, 30100, null, 0.28, 35, 0.00],
    ['452010', 'Fritidskonsulent', 4, 0.50, ['E'], 0.0, 43500, null, 0.17, 45, 0.16],
    ['452011', 'Fritidsledare', 75, 0.55, ['C', 'F'], 0.2, 32700, 36700, 0.35, 44, 0.16],
    ['452014', 'Badpersonal', 13, 0.55, ['C'], 0.0, 32000, null, 0.26, 39, 0.11],
    ['501010', 'Samhällsplanerare', 35, 0.70, ['H', 'I'], 0.3, 46100, 57400, 0.33, 47, 0.14],
    ['501011', 'Bygglovshandläggare', 4, 1.00, ['H'], 0.0, 45200, null, 0.09, 45, 0.20],
    ['501012', 'Byggnadsinspektör', 5, 0.00, ['H'], 0.0, 45800, null, 0.19, 35, 0.17],
    ['501013', 'Miljöinspektör', 12, 0.65, ['H'], 0.0, 41400, null, 0.27, 45, 0.16],
    ['502010', 'Systemutvecklare', 18, 0.55, ['G', 'H'], 0.6, 43700, 46100, 0.39, 45, 0.14],
    ['502012', 'Trafikingenjör', 19, 0.40, ['I'], 0.0, 65600, null, 0.40, 50, 0.16],
    ['502013', 'Fastighetsingenjör', 35, 0.40, ['G', 'H'], 0.4, 49700, 52200, 0.38, 44, 0.15],
    ['502014', 'VA-ingenjör', 35, 0.45, ['G', 'H'], 0.6, 44400, 53700, 0.33, 45, 0.20],
    ['503010', 'IT-tekniker', 16, 0.10, ['E'], 0.0, 34700, null, 0.30, 38, 0.17],
    ['503012', 'Drifttekniker', 20, 0.00, ['E'], 0.0, 38400, null, 0.24, 48, 0.15],
    ['503090', 'Tekniker övrigt', 14, 0.05, ['D'], 0.0, 37400, null, 0.21, 42, 0.08],
    ['521012', 'Anläggningsarbetare', 13, 0.10, ['C'], 0.0, 34800, null, 0.37, 43, 0.19],
    ['521013', 'Hantverkare', 6, 0.00, ['D'], 0.0, 34600, null, 0.26, 42, 0.11],
    ['521015', 'Vaktmästare', 45, 0.20, ['B', 'C'], 0.3, 30700, 33200, 0.31, 37, 0.22],
    ['521018', 'Trädgårdsarbetare', 19, 0.65, ['C', 'D'], 0.7, 31300, 33700, 0.27, 46, 0.10],
    ['601010', 'Kock', 115, 0.70, ['C'], 0.0, 31500, null, 0.26, 40, 0.12],
    ['651010', 'Lokalvårdare', 105, 0.85, ['A'], 0.0, 28300, null, 0.28, 38, 0.14],
]);
// Oförklarat gap för kvinnor (andel av lönen) per AID, i fyra blandade yrken med minst 40 personer.
/** @type {Readonly<Record<string, number>>} */
const _SD_GAP = Object.freeze({ '401011': -0.025, '401012': -0.04, '207090': -0.035, '601010': -0.03 });
// Likvärdigt arbete: ett mansdominerat tekniskt yrke (hog) med högre lön än ett kvinnodominerat vårdyrke (lag) i
// samma BAS-intervall.
const _SD_LIKVARDIGT = Object.freeze({ hog: '503090', lag: '207011', bas: 'D' });

function generateStortDemo() {
    // Samma slags seedade slump som generateTestData, med ett eget frö: samma underlag vid varje anrop.
    let seed = 5000;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const rndNorm = () => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const data = [];
    for (const [aid, namn, n, andelKv, basLista, andelHog, nivaL, nivaH, spridning, medelalder] of _SD_YRKEN) {
        const kvinnor = Math.round(n * andelKv);
        const yrke = `${aid} ${namn}`;
        const gap = _SD_GAP[aid] || 0;
        const chefKod = aid.startsWith('10') ? ['C'] : null;
        const personer = [];
        for (let i = 0; i < n; i++) {
            const kon = i < kvinnor ? 'kvinna' : 'man';
            const alder = Math.max(20, Math.min(66, Math.round(medelalder + rndNorm() * 10)));
            // Plats i yrkets högre intervall: äldre och män hamnar där något oftare.
            const poang = rnd() - (arMan({ kon }) ? 0.12 : 0) - (alder - 44) * 0.008;
            personer.push({ kon, alder, poang });
        }
        // Andelen andelHog i det högre intervallet, när yrket har två.
        const iHogre = basLista.length > 1 ? new Set([...personer].sort((a, b) => a.poang - b.poang).slice(0, Math.round(n * andelHog))) : new Set();
        for (const p of personer) {
            const hogre = iHogre.has(p);
            const bas = basLista[hogre ? 1 : 0];
            const niva = hogre ? /** @type {number} */ (nivaH) : nivaL;
            const alderseffekt = 0.92 + 0.16 * (1 - Math.exp(-(p.alder - 20) / 12));   // brant tidigt, flack sent
            const konseffekt = arKvinna(p) ? 1 + gap : 1;
            // P10–P90 är ungefär ±1,28 standardavvikelser: spridningen / 2,56 ger yrkets spridning. Bruset kapas vid
            // ±2,5 standardavvikelser, så att ingen lön hamnar orimligt lågt i ett yrke med stor spridning.
            const brus = Math.max(-2.5, Math.min(2.5, rndNorm())) * spridning / 2.56;
            const lon = Math.round(niva * alderseffekt * konseffekt * (1 + brus));
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
    announceToScreenReader(`Stort demo inläst: ${svTal(state.data.length)} påhittade personer i ${getBasIntervals().length} ${termForAntal(getBasIntervals().length, T.niva)}.`);
}
['first-run-stort-demo', 'upload-demo-stort'].forEach(id =>
    document.getElementById(id)?.addEventListener('click', loadStortDemo));

// Figurer som täcker varje märke och val i ritaren, med små grupper (`liten`) som har iögonfallande
// värden, storlekar, etiketter, felstaplar och nycklar. Används av differentialtestet för små grupper
// (ritning med dolda små grupper ska vara identisk med ritning av en figur där de tagits bort).
// Tillkommer ett märke eller val: lägg till en figur här.
const HEM = (x, extra = {}) => ({ x, y: 98765, liten: true, etikett: 'ETIK-HEMLIG-LÅNG-ETIKETT', nyckel: 'NYCK-HEMLIG', fel: { lag: 91111, hog: 99333 }, storlek: 40, ...extra });
const bas = (over = {}) => ({ beskrivning: 'b', x: { skala: 'band', titel: 'BAS' }, y: { skala: 'linjar', titel: 'Kr', format: 'kr' }, lager: [], ...over });
const A5 = ['A', 'B', 'C', 'D', 'E'];
// Individer till ett lådlager: en punkt per lön i kategorin x; `sma` är de platser (index) som är små.
const IND = (x, loner, sma = []) => loner.map((y, i) => (sma.includes(i) ? { x, y, liten: true, nyckel: 'NYCK-HEMLIG' } : { x, y }));

//
// TÄCKNING — testet "S1/T2" kräver (a) att varje figur har en liten punkt som ritas med visaSma, (b) att varje märke i
// _RF_MARKEN har en figur med en liten punkt, och (c) att listan nedan stämmer. Tillkommer ett märke fallerar (b)
// tills det finns en figur här. Val → figur (namn):
//   riktning 'liggande'      → "staplar liggande med etiketter", "punkter, alla symboler"
//   lage 'staplad'           → "staplar staplade", "staplar staplade med etiketter" (liten punkt med etikett i ett staplat lager)
//   lage 'overlagrad' + bredd→ "staplar överlagrade med bredd" (lagret med `bredd` har en egen liten punkt)
//   lage 'bredvid' (flera)   → "staplar bredvid", "staplar tre serier, mittenserien liten"
//   etikett                  → "staplar med etiketter och fel", "staplar liggande med etiketter" (och HEM har etikett)
//   fel                      → "staplar med etiketter och fel" (HEM har fel)
//   storlek                  → "punkter på talaxlar med storlek", "punkter, alla symboler" (HEM har storlek 40)
//   forskjutning             → "punkter på band med förskjutning"
//   symbol (alla fyra)       → "punkter, alla symboler"
//   punkter, tips (linje)    → "linje med punkter och tips"
//   kurva monoton, streck    → "linje monoton på talaxel"
//   axel 'y2'                → "höger axel med lager", "höger axel där hela lagret är litet"
//   paneler (två, tre, tom)  → "två paneler", "tre paneler, en helt liten", "lager utan panel i två paneler"
//   ordning                  → "x.ordning nämner en liten kategori", "kategoriordning A–E ..."
//   logaritmisk axel         → "logaritmisk axel"
//   nedsampling              → "punktmoln som nedsamplas" (fler än SCATTER_MAX_POINTS = 8 000 punkter, liten punkt först)
//   dolda serier             → "dolda serier"
//   not, bakgrund            → "not och bakgrund"
//   zon på bandaxel          → "zon på bandaxel" (en zon vars gräns är en liten kategori ritas inte)
//   monster                  → "staplar med mönster"
//   punktens etikett, referenslinjens etikett → "punkter med etikett och referenslinje med etikett"
//   etikett på liten stapel INNE i domänen → "staplar: liten punkt inne i domänen med lång etikett" (vaktar filtret i _rfEtikettBeslut)
// Uppgift 5 — varje val som ändrar geometrin har en figur med en liten punkt som INTE ligger sist i sin lista:
//   band                     → "band med linje på talaxel", "band över kategorier"
//   band, x.ordning ≠ data   → "band över kategorier i annan ordning än datan" (bandet sorteras efter axelns ordning:
//                              sorteringen får inte bero på de små punkterna; en liten punkt mitt i datan och en först i ordningen)
//   intervall stående        → "intervall stående"
//   intervall liggande       → "intervall liggande, två lager och medianstreck"
//   lada, punkter 'avvikare' → "lådor med avvikare" (små individer i en kategori som finns kvar, och en helt liten kategori)
//   lada, punkter 'alla'     → "lådor, alla individer" (små individer FÖRE de övriga i samma kategori: spridningen i sidled)
//   lada 'alla', nedsamplad  → "individer som nedsamplas" (fler än 8 000 individer, små först och utspridda),
//                              "individer strax under nedsamplingsgränsen, med små" (stegets storlek)
//   två lådlager bredvid     → "två lådlager bredvid varandra, ett helt litet emellan"
//   ruta med visaText        → "rutor med text" (en liten cell bär en text som inte ryms: vaktar alla-eller-inga-beslutet)
//   ruta utan visaText       → "rutor utan text", "rutor i två paneler"
//   punkt med fargvarde      → "punkter med färgvärde och storlek"
//   referens (zon och linje) → "referenser: zoner och linjer", "referenser på kategoriaxel och höger axel"

/** @returns {Array<[string, object, object]>} [namn, figur, val (utan visaSma)] */
export function ritfigurer() {
    return [
        ['staplar bredvid', bas({ lager: [{ marke: 'stapel', serie: 'S0', data: [{ x: 'A', y: 10 }, HEM('HEMLIG'), { x: 'B', y: 12 }] }, { marke: 'stapel', serie: 'S1', data: [{ x: 'A', y: 11 }, { x: 'B', y: 9 }] }] })],
        ['staplar med etiketter och fel', bas({ lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 10, etikett: 'tio', fel: { lag: 8, hog: 12 } }, HEM('HEMLIG'), { x: 'B', y: 12, etikett: 'tolv' }] }] })],
        ['staplar staplade', bas({ lager: [{ marke: 'stapel', lage: 'staplad', serie: 'S0', data: [{ x: 'A', y: 98765, liten: true }, { x: 'B', y: 5 }, { x: 'C', y: -2 }] }, { marke: 'stapel', lage: 'staplad', serie: 'S1', data: [{ x: 'A', y: 10 }, { x: 'B', y: 6 }, { x: 'C', y: -3 }] }] })],
        ['staplar överlagrade med bredd', bas({ lager: [{ marke: 'stapel', lage: 'overlagrad', serie: 'S0', data: [{ x: 'A', y: 10 }, HEM('HEMLIG')] }, { marke: 'stapel', lage: 'overlagrad', bredd: 0.5, serie: 'S1', data: [{ x: 'A', y: 5 }, HEM('HEMLIG-B')] }] })],
        ['staplar staplade med etiketter', bas({ lager: [{ marke: 'stapel', lage: 'staplad', serie: 'S0', data: [{ x: 'A', y: 8, etikett: 'åtta' }, HEM('B'), { x: 'C', y: 6, etikett: 'sex' }] }, { marke: 'stapel', lage: 'staplad', serie: 'S1', data: [{ x: 'A', y: 10, etikett: 'tio' }, { x: 'B', y: 7, etikett: 'sju' }, HEM('HEMLIG')] }] })],
        ['staplar liggande med etiketter', bas({ x: { skala: 'linjar', format: 'pct' }, y: { skala: 'band' }, lager: [{ marke: 'stapel', riktning: 'liggande', serie: 'S', data: [{ y: 'A', x: 10, etikett: 'a' }, { y: 'HEMLIG', x: 98765, liten: true, etikett: 'ETIK-HEMLIG-LÅNG-LÅNG-LÅNG-ETIKETT' }, { y: 'B', x: -3, etikett: 'b' }] }] })],
        ['staplar tre serier, mittenserien liten', bas({ lager: [{ marke: 'stapel', serie: 'S0', data: [{ x: 'A', y: 3 }] }, { marke: 'stapel', serie: 'HEMLIG-S', data: [HEM('A')] }, { marke: 'stapel', serie: 'S2', data: [{ x: 'A', y: 4 }] }] })],
        ['punkter på band med förskjutning', bas({ lager: [{ marke: 'punkt', serie: 'P', tips: () => [['HEMLIG']], data: [{ x: 'A', y: 10 }, HEM('HEMLIG', { forskjutning: 0.3 }), { x: 'B', y: 12, forskjutning: 0.2 }] }] })],
        ['punkter på talaxlar med storlek', bas({ x: { skala: 'linjar' }, lager: [{ marke: 'punkt', serie: 'P', data: [{ x: 1, y: 10, storlek: 4 }, { x: 2, y: 11, liten: true, storlek: 40 }, { x: 3, y: 12, storlek: 5 }] }] })],
        ['punkter, alla symboler', bas({ x: { skala: 'linjar' }, y: { skala: 'band' }, lager: ['cirkel', 'streck', 'triangelVanster', 'triangelHoger'].map((symbol, i) => ({ marke: 'punkt', symbol, serie: symbol, storlek: 5, data: [{ y: 'A', x: 5 + i }, { y: 'HEMLIG', x: 98765, liten: true, storlek: 40 }, { y: 'B', x: 3 + i }] })) })],
        ['linje med punkter och tips', bas({ lager: [{ marke: 'linje', serie: 'L', punkter: true, tips: () => [['HEMLIG']], data: [{ x: 'A', y: 10 }, HEM('HEMLIG'), { x: 'B', y: 12 }] }] })],
        ['linje monoton på talaxel', bas({ x: { skala: 'linjar' }, lager: [{ marke: 'linje', serie: 'L', kurva: 'monoton', streck: 'streckad', data: [{ x: 1, y: 10 }, { x: 2, y: 98765, liten: true }, { x: 3, y: 12 }, { x: 4, y: 13 }] }] })],
        ['kategoriordning A–E: små punkter först i lager 1', bas({ lager: [{ marke: 'linje', serie: 'L1', data: [{ x: 'A', y: 1 }, { x: 'B', y: 99999, liten: true }, { x: 'C', y: 3 }, { x: 'D', y: 99999, liten: true }, { x: 'E', y: 5 }] }, { marke: 'linje', serie: 'L2', data: A5.map((x, i) => ({ x, y: 2 + i })) }] })],
        ['x.ordning nämner en liten kategori', bas({ x: { skala: 'band', ordning: ['HEMLIG', 'B', 'A'] }, lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 1 }, HEM('HEMLIG'), { x: 'B', y: 2 }] }] })],
        ['höger axel med lager', bas({ y2: { skala: 'linjar', titel: 'Antal' }, lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 3 }, { x: 'B', y: 4 }] }, { marke: 'linje', axel: 'y2', serie: 'N', data: [{ x: 'A', y: 5 }, HEM('HEMLIG'), { x: 'B', y: 7 }] }] })],
        ['höger axel där hela lagret är litet', bas({ y2: { skala: 'linjar', titel: 'Antal' }, lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 3 }] }, { marke: 'linje', axel: 'y2', serie: 'N', data: [HEM('A')] }] })],
        ['två paneler', bas({ paneler: ['Kvinna', 'Man'], lager: [{ marke: 'stapel', panel: 'Kvinna', serie: 'K', data: [{ x: 'A', y: 1 }, HEM('HEMLIG')] }, { marke: 'stapel', panel: 'Man', serie: 'M', data: [{ x: 'A', y: 2 }] }] })],
        ['tre paneler, en helt liten', bas({ paneler: ['HemligPanel', 'Kvinna', 'Man'], lager: [{ marke: 'punkt', panel: 'Kvinna', serie: 'K', data: [{ x: 'A', y: 1 }] }, { marke: 'punkt', panel: 'Man', serie: 'M', data: [{ x: 'A', y: 1 }] }, { marke: 'punkt', panel: 'HemligPanel', serie: 'H', data: [HEM('A')] }] })],
        ['lager utan panel i två paneler', bas({ paneler: ['P1', 'P2'], lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 1 }, HEM('HEMLIG')] }] })],
        ['en helt liten serie bland andra', bas({ lager: [{ marke: 'stapel', serie: 'Stor', data: [{ x: 'A', y: 1 }] }, { marke: 'stapel', serie: 'HEMLIG-SERIE', data: [HEM('A')] }, { marke: 'linje', serie: 'HemligLinje', data: [HEM('A'), HEM('B')] }] })],
        ['logaritmisk axel', bas({ x: { skala: 'linjar' }, y: { skala: 'log' }, lager: [{ marke: 'punkt', data: [{ x: 1, y: 10 }, { x: 2, y: 98765, liten: true, storlek: 40 }, { x: 3, y: 100 }] }] })],
        // Fler än SCATTER_MAX_POINTS (8 000) synliga punkter: var annan ritas. Den lilla punkten ligger först, så den ritas med visaSma.
        ['punktmoln som nedsamplas', bas({ x: { skala: 'linjar' }, lager: [{ marke: 'punkt', serie: 'P', data: [{ x: 4321, y: 98765, liten: true, storlek: 40 }, ...Array.from({ length: 8200 }, (_, i) => ({ x: (i * 37) % 1000, y: 20000 + ((i * 7919) % 30000) }))] }] })],
        ['dolda serier', bas({ lager: [{ marke: 'stapel', serie: 'Syns', data: [{ x: 'A', y: 1 }, HEM('SYNLIG-HEMLIG')] }, { marke: 'stapel', serie: 'Dold', data: [{ x: 'A', y: 2 }, HEM('HEMLIG')] }] }), { dolda: new Set(['Dold']) }],
        ['egen färg på liten punkt', bas({ lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 10 }, HEM('HEMLIG', { farg: '#abcdef' })] }] })],
        ['allt litet', bas({ lager: [{ marke: 'stapel', serie: 'HEMLIG-S', data: [HEM('HEMLIG')] }] })],
        ['not och bakgrund', bas({ lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 1 }, HEM('HEMLIG')] }] }), { not: 'En not som är ganska lång och som ska radbrytas av ritaren på två rader.', bakgrund: '#ffffff' }],
        // En liten stapel INNE i domänen (värdet sticker inte ut) med en lång etikett: utan filtret på dolda punkter i
        // etikettbeslutet skulle dess bredd avgöra om lagrets övriga etiketter ritas.
        ['staplar: liten punkt inne i domänen med lång etikett', bas({ lager: [{ marke: 'stapel', serie: 'S0', data: [{ x: 'A', y: 10, etikett: 'tio' }, { x: 'C', y: 5, liten: true, etikett: 'ETIK-HEMLIG-EN-MYCKET-LÅNG-ETIKETT-SOM-INTE-RYMS' }, { x: 'B', y: 9, etikett: 'nio' }] }, { marke: 'stapel', serie: 'S1', data: [{ x: 'A', y: 11 }, { x: 'C', y: 9 }, { x: 'B', y: 8 }] }] })],
        // --- Uppgift 5: band, intervall, låda, ruta, färgskala, referenser ---
        ['band med linje på talaxel', bas({ x: { skala: 'linjar' }, lager: [{ marke: 'band', serie: 'KI', kurva: 'monoton', data: [{ x: 1, lag: 8, hog: 12 }, { x: 2, lag: 91111, hog: 99333, liten: true, nyckel: 'NYCK-HEMLIG' }, { x: 3, lag: 9, hog: 14 }, { x: 4, lag: 10, hog: 15 }] }, { marke: 'linje', serie: 'Trend', kurva: 'monoton', data: [{ x: 1, y: 10 }, { x: 3, y: 11 }, { x: 4, y: 12 }] }] })],
        ['band över kategorier', bas({ lager: [{ marke: 'band', serie: 'KI', data: [{ x: 'A', lag: 8, hog: 12 }, { x: 'HEMLIG', lag: 91111, hog: 99333, liten: true }, { x: 'B', lag: 9, hog: 14 }, { x: 'C', lag: 10, hog: 15 }] }] })],
        ['band över kategorier i annan ordning än datan', bas({ x: { skala: 'band', ordning: ['HEMLIG', 'D', 'B', 'HEMLIG2', 'A', 'C'] }, lager: [{ marke: 'band', serie: 'KI', data: [{ x: 'A', lag: 8, hog: 12 }, { x: 'HEMLIG', lag: 91111, hog: 99333, liten: true }, { x: 'B', lag: 9, hog: 14 }, { x: 'HEMLIG2', lag: 1, hog: 98765, liten: true, nyckel: 'NYCK-HEMLIG' }, { x: 'C', lag: 10, hog: 15 }, { x: 'D', lag: 11, hog: 13 }] }] })],
        ['intervall stående', bas({ lager: [{ marke: 'intervall', serie: 'P10–P90', tjocklek: 10, data: [{ x: 'A', lag: 8, hog: 12 }, { x: 'HEMLIG', lag: 91111, hog: 99333, liten: true, farg: '#abcdef' }, { x: 'B', lag: 9, hog: 14 }, { x: 'A2', lag: 3, hog: 98765, liten: true }, { x: 'C', lag: 10, hog: 15 }] }] })],
        ['intervall liggande, två lager och medianstreck', bas({ x: { skala: 'linjar', format: 'kr' }, y: { skala: 'band' }, lager: [
            { marke: 'intervall', riktning: 'liggande', serie: 'Marknad', farg: '#94a3b8', tjocklek: 12, data: [{ y: 'A', lag: 20, hog: 60 }, { y: 'HEMLIG', lag: 1, hog: 98765, liten: true }, { y: 'B', lag: 30, hog: 70 }] },
            { marke: 'intervall', riktning: 'liggande', serie: 'Egen', tjocklek: 5, data: [{ y: 'A', lag: 25, hog: 50 }, { y: 'B', lag: 91111, hog: 99333, liten: true }, { y: 'C', lag: 35, hog: 65 }] },
            { marke: 'punkt', symbol: 'streck', serie: 'Median', data: [{ y: 'A', x: 40 }, { y: 'B', x: 98765, liten: true }, { y: 'C', x: 50 }] }] })],
        ['lådor med avvikare', bas({ lager: [{ marke: 'lada', punkter: 'avvikare', serie: 'Lön', data: [...IND('A', [10, 12, 98765, 13, 14, 91111, 15, 16, 17, 18, 40], [2, 5]), ...IND('HEMLIG', [99333, 98765, 91111], [0, 1, 2]), ...IND('B', [20, 21, 22, 23, 3])] }] })],
        ['lådor, alla individer', bas({ lager: [{ marke: 'lada', punkter: 'alla', serie: 'Lön', data: [...IND('A', [98765, 10, 91111, 12, 13, 14, 99333, 15], [0, 2, 6]), ...IND('HEMLIG', [98765, 91111], [0, 1]), ...IND('B', [20, 98765, 21, 22], [1])] }] })],
        ['två lådlager bredvid varandra, ett helt litet emellan', bas({ lager: [
            { marke: 'lada', serie: 'Kvinna', data: [...IND('A', [10, 98765, 12, 13, 14, 30], [1]), ...IND('B', [20, 21, 22])] },
            { marke: 'lada', serie: 'HEMLIG-S', data: [...IND('A', [98765, 91111, 99333], [0, 1, 2]), ...IND('B', [98765], [0])] },
            { marke: 'lada', serie: 'Man', data: [...IND('A', [91111, 11, 12, 15]), ...IND('B', [98765, 19, 23, 24], [0])].map((d, i) => (i === 0 ? { ...d, liten: true } : d)) }] })],
        ['rutor med text', bas({ y: { skala: 'band' }, fargskala: { typ: 'divergerande', doman: [80, 120], mitt: 100, titel: 'Index' }, lager: [{ marke: 'ruta', serie: 'Index', visaText: true, data: [{ x: 'A', y: 'r1', varde: 90, text: '90' }, { x: 'HEMLIG', y: 'r1', varde: 98765, text: 'TEXT-HEMLIG', liten: true }, { x: 'B', y: 'r1', varde: 110, text: '110' }, { x: 'A', y: 'r2', varde: 91111, text: 'ETIK-HEMLIG-EN-TEXT-SOM-ÄR-SÅ-LÅNG-ATT-DEN-INTE-RYMS-I-NÅGON-RUTA-ALLS', liten: true }, { x: 'B', y: 'YHEMLIG', varde: 99333, text: '99333', liten: true }, { x: 'B', y: 'r2', varde: 100, text: '100' }] }] })],
        ['rutor utan text', bas({ y: { skala: 'band' }, fargskala: { typ: 'sekventiell', doman: [0, 100], titel: 'Gap', format: 'pct' }, lager: [{ marke: 'ruta', serie: 'Gap', data: [{ x: 'A', y: 'r1', varde: 10, text: 'tio' }, { x: 'HEMLIG', y: 'r1', varde: 98765, text: 'TEXT-HEMLIG', liten: true }, { x: 'B', y: 'r1', varde: 60 }, { x: 'B', y: 'r2', varde: 30 }] }] })],
        ['rutor i två paneler', bas({ y: { skala: 'band' }, paneler: ['Kvinna', 'Man'], fargskala: { typ: 'sekventiell', doman: [0, 100], titel: 'Median' }, lager: [
            { marke: 'ruta', panel: 'Kvinna', serie: 'Median', data: [{ x: 'A', y: 'r1', varde: 10 }, { x: 'HEMLIG', y: 'r1', varde: 98765, liten: true }, { x: 'B', y: 'r2', varde: 60 }] },
            { marke: 'ruta', panel: 'Man', serie: 'Median', data: [{ x: 'A', y: 'r1', varde: 91111, liten: true }, { x: 'A', y: 'r2', varde: 40 }, { x: 'B', y: 'r1', varde: 80 }] }] })],
        ['punkter med färgvärde och storlek', bas({ x: { skala: 'linjar' }, fargskala: { typ: 'tvafarg', doman: [0, 100], titel: 'Andel kvinnor', format: 'pct' }, lager: [{ marke: 'punkt', serie: 'Yrken', data: [{ x: 1, y: 10, storlek: 6, fargvarde: 20 }, { x: 98765, y: 91111, storlek: 40, fargvarde: 99333, liten: true }, { x: 3, y: 12, storlek: 9, fargvarde: 80 }, { x: 2, y: 11, storlek: 30, fargvarde: 50, liten: true }, { x: 4, y: 14, storlek: 12, fargvarde: 55 }] }] })],
        // Zonen utan x1 når domänens ände — som bara får bero på de punkter som ritas. Linjen x = 50 ligger utanför domänen utan de små.
        ['referenser: zoner och linjer', bas({ x: { skala: 'linjar' }, referens: [{ typ: 'zon', x0: 3, farg: '#fee2e2', etikett: 'Zon utan slut' }, { typ: 'zon', y0: 11, y1: 12, etikett: 'Vågrät zon' }, { typ: 'linje', x: 2, streck: 'streckad' }, { typ: 'linje', y: 11.5 }, { typ: 'linje', x: 50 }, { typ: 'linje', y: 98765 }],
            lager: [{ marke: 'punkt', serie: 'P', data: [{ x: 1, y: 10 }, { x: 60, y: 98765, liten: true, storlek: 40 }, { x: 3, y: 12 }, { x: 4, y: 13 }] }] })],
        ['referenser på kategoriaxel och höger axel', bas({ y2: { skala: 'linjar', titel: 'Antal' }, referens: [{ typ: 'linje', x: 'HEMLIG' }, { typ: 'linje', x: 'B', streck: 'prickad' }, { typ: 'linje', y: 6, axel: 'y2' }, { typ: 'zon', y0: 2, etikett: 'Över två' }],
            lager: [{ marke: 'stapel', serie: 'S', data: [{ x: 'A', y: 3 }, HEM('HEMLIG'), { x: 'B', y: 4 }] }, { marke: 'linje', axel: 'y2', serie: 'N', data: [{ x: 'A', y: 5 }, HEM('HEMLIG'), { x: 'B', y: 7 }] }] })],
        // Fler än SCATTER_MAX_POINTS (8 000) individer: var annan ritas. De små ligger först och utspridda (aldrig sist),
        // så både urvalet och spridningen i sidled skulle röja dem om de räknades med.
        ['individer som nedsamplas', bas({ lager: [{ marke: 'lada', punkter: 'alla', serie: 'Lön', data: [{ x: 'A', y: 98765, liten: true, nyckel: 'NYCK-HEMLIG' }, ...Array.from({ length: 8300 }, (_, i) => ({ x: A5[i % 5], y: 20000 + ((i * 7919) % 30000), ...(i % 97 === 3 ? { liten: true } : {}) })), { x: 'A', y: 25000 }] }] })],
        // 7 990 individer som ritas + 20 små = 8 010 i lagret: urvalets steg får bara räknas ur dem som ritas (då
        // nedsamplas inget); räknat ur hela lagret skulle varannan individ försvinna — ett spår av de små.
        ['individer strax under nedsamplingsgränsen, med små', bas({ lager: [{ marke: 'lada', punkter: 'alla', serie: 'Lön', data: Array.from({ length: 8010 }, (_, i) => ({ x: A5[i % 5], y: 20000 + ((i * 7919) % 30000), ...(i % 400 === 7 ? { liten: true } : {}) })) }] })],
        // Zon mellan kategorier på en bandaxel: en liten kategori utanför zonen, och en zon vars gräns ÄR den lilla.
        ['zon på bandaxel', bas({ lager: [{ marke: 'stapel', serie: 'A', data: [{ x: 'A', y: 30000 }, HEM('B'), { x: 'C', y: 32000 }, { x: 'D', y: 34000 }] }],
            referens: [{ typ: 'zon', x0: 'C', x1: 'D', etikett: 'Zon CD' }, { typ: 'zon', x0: 'B', x1: 'B', etikett: 'ZON-HEMLIG' }] })],
        ['staplar med mönster', bas({ lager: [{ marke: 'stapel', serie: 'Kritisk', monster: 'linjer', lage: 'overlagrad', data: [{ x: 'A', y: 30000 }, HEM('B')] },
            { marke: 'stapel', serie: 'Varning', monster: 'prickar', lage: 'overlagrad', data: [HEM('C'), { x: 'D', y: 34000 }] }] })],
        ['punkter med etikett och referenslinje med etikett', { beskrivning: 'b', x: { skala: 'linjar' }, y: { skala: 'linjar' },
            referens: [{ y: 30000, etikett: 'Gräns' }, { x: 3, etikett: 'Lodrät' }],
            lager: [{ marke: 'punkt', serie: 'P', data: [{ x: 1, y: 20000, etikett: 'Ett' }, { x: 2, y: 98765, liten: true, etikett: 'ETIK-HEMLIG', storlek: 40 }, { x: 4, y: 40000, etikett: 'Fyra' }] }] }],
        // --- Fria ytor (trädkartan): en liten yta med eget namn, värde och färgvärde; dolda axlar ---
        ['fria ytor med dolda axlar', { beskrivning: 'b', legend: false, x: { skala: 'linjar', doman: [0, 2], dold: true }, y: { skala: 'linjar', doman: [0, 1], dold: true },
            fargskala: { typ: 'divergerande', doman: [0, 100], mitt: 50, titel: 'Andel' },
            lager: [{ marke: 'yta', serie: 'Ytor', data: [{ x0: 0, x1: 1, y0: 0, y1: 1, namn: 'Stor', etikett: 'Stor', undertext: '40 personer', fargvarde: 70, varde: 40 },
                { x0: 1, x1: 2, y0: 0.5, y1: 1, namn: 'Halv', etikett: 'Halv', fargvarde: 20, varde: 20 },
                { x0: 1, x1: 2, y0: 0, y1: 0.5, namn: 'HEMLIG', etikett: 'ETIK-HEMLIG', undertext: '98765', fargvarde: 98, varde: 98765, liten: true }] }] }],
    ].map(([namn, f, val]) => [namn, f, val || {}]);
}

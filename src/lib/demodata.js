// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — demodatan: de påhittade underlagen i demoläget och självdiagnostiken.
 *
 * Rena generatorer med en egen deterministisk slump (LCG med fast frö): samma rader, i samma ordning, vid varje
 * anrop. Det lilla demot (genereraTestdata, genereraDemodata) är självdiagnostikens och testsvitens kända underlag;
 * det stora (genereraStortDemo m.fl.) visar verktyget i verklig storlek. Allt är påhittat: inga personer, inga namn,
 * ingen verklig organisation. Inläsningen i demoläget (state, DOM) står i src/app/20-demodata-diagnostik.js och
 * src/app/21-stort-demo.js.
 */
import { arKvinna, arMan } from './kon.js';
import { ansvarsgrupp as _anGrupp } from './ansvar.js';
import { _normaliseraPolicyAid } from './inlasning.js';
import { median, kvantil } from './stat.js';
import { basRangordning } from './likvardighet.js';
import { konsMedianer } from './struktur.js';
import { svPct } from './talformat.js';

// ---- Det lilla demot ----
export function genereraTestdata() {
    // Syntetisk dataset: 200 personer, 5 BAS (A-E), känd struktur:
    // - Lön = 30000 + BAS_rank*5000 + age_centered*200 + random_noise
    // - Kön-effekt: kvinnor får -3% justerad lön (oförklarat gap = ~3%)
    // - Naturligt råa gapet ca -8% pga att kvinnor är yngre i snitt
    const data = [];
    const basList = ['A','B','C','D','E'];
    const aidList = ['402010 Förskollärare', '207024 Vårdbiträde', '502010 Systemutvecklare', '401011 Lärare grundskola', '206017 Sjuksköterska'];
    let seed = 42;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const rndNorm = () => { let u = 0, v = 0; while(u === 0) u = rnd(); while(v === 0) v = rnd(); return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v); };
    for (let i = 0; i < 200; i++) {
        const isKvinna = i < 100; // 50/50
        // Kvinnor är i snitt något yngre + tenderar att hamna i lägre BAS
        const baseAge = isKvinna ? 38 : 44;
        const alder = Math.max(22, Math.min(65, Math.round(baseAge + rndNorm() * 8)));
        const basRank = isKvinna
            ? Math.max(0, Math.min(4, Math.round(1.5 + rndNorm() * 1.2)))
            : Math.max(0, Math.min(4, Math.round(2.5 + rndNorm() * 1.2)));
        const bas = basList[basRank];
        const yrke = aidList[basRank];
        // Lön: baseras på BAS + ålder + ev kön-bias
        const baseLon = 30000 + basRank * 5000 + (alder - 40) * 250;
        const konPenalty = isKvinna ? -baseLon * 0.03 : 0; // -3% för kvinnor
        const noise = rndNorm() * 1500;
        const lon = Math.round(baseLon + konPenalty + noise);
        data.push({
            bas, yrke,
            lon: Math.max(20000, lon),
            alder,
            kon: isKvinna ? 'kvinna' : 'man'
        });
        // Ett slumptal per person dras och används inte: testdatan — och självdiagnostikens
        // förväntade värden — bygger på den dragningsföljden.
        rnd();
    }
    return data;
}

// Demodata ("Prova med demodata"): självdiagnostikens 200 personer med AID och
// yrkesnamn, plus tre yrken i BAS C som ger kandidatpar i likvärdigt arbete — två
// kvinnodominerade yrken med lägre lön än ett mansdominerat på samma nivå. Systemutvecklare i BAS C (23 kvinnor av
// 45) är blandad och därmed också jämförelseyrke (ADR-60).
// genereraTestdata() lämnas orörd: självdiagnostiken bygger på dess kända egenskaper.
export function genereraDemodata() {
    const data = genereraTestdata().map(r => ({
        ...r, aid: r.yrke.split(' ')[0], yrkeLabel: r.yrke.replace(/^\d+\s*/, '')
    }));
    const lagg = (yrke, n, kvinnor, grundlon) => {
        for (let i = 0; i < n; i++) {
            const alder = 26 + ((i * 7) % 34);
            data.push({
                bas: 'C', yrke, aid: yrke.split(' ')[0], yrkeLabel: yrke.replace(/^\d+\s*/, ''),
                lon: Math.round(grundlon + (alder - 40) * 150 + ((i * 37) % 11 - 5) * 120),
                alder, kon: i < kvinnor ? 'kvinna' : 'man'
            });
        }
    };
    lagg('403010 Barnskötare', 20, 18, 36500);    // 90 % kvinnor
    lagg('207011 Undersköterska', 20, 17, 37500); // 85 % kvinnor
    lagg('503012 Drifttekniker', 20, 3, 42500);   // 15 % kvinnor
    // Ansvarskod (AID): var 15:e man och var 30:e kvinna har ledningsansvar, var 30:e person
    // ett särskilt uppdrag och var 15:e lärare är förstelärare. Påverkar inte lönerna.
    const raknare = { kvinna: 0, man: 0 };
    let larare = 0;
    data.forEach((r, i) => {
        const nr = ++raknare[r.kon];
        let koder = [];
        if ((r.kon === 'man' && nr % 15 === 0) || (r.kon === 'kvinna' && nr % 30 === 0)) koder = ['C'];
        else if (r.aid === '401011' && ++larare % 15 === 0) koder = ['1002'];
        else if ((i + 1) % 30 === 0) koder = ['F'];
        r.ansvarskoder = koder;
        r.ansvarsgrupp = _anGrupp(koder);
    });
    return data;
}

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
//   - små grupper: yrken under tio personer och yrken där ett kön är färre än tio, så att maskeringen vid
//     minsta gruppstorlek syns i exporterna.
// Ansvarskoderna följer det lilla demots regel (ledningsansvar, särskilt uppdrag, förstelärare); cheferna (AID som
// börjar med 10) har ledningsansvar. Ansvarskoderna påverkar inte lönerna.

const _SD_BAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
// [AID, namn, antal, andel kvinnor, BAS-intervall (det lägre, ev. det högre), andel i det högre intervallet,
//  nivå i det lägre (kr), nivå i det högre (kr) eller null, spridning ((P90 − P10) / median), medelålder,
//  påslag i den påhittade jämförelsestatistiken]
// Antalen summerar till 5 000.
/** @type {ReadonlyArray<[string, string, number, number, string[], number, number, number|null, number, number, number]>} */
const _SD_YRKEN = Object.freeze([
    ['103510', 'Chef individ- och familjeomsorg', 17, 0.95, ['J'], 0.0, 58900, null, 0.20, 51, 0.25],
    ['103511', 'Enhetschef äldreomsorg', 50, 0.90, ['J'], 0.0, 55200, null, 0.36, 49, -0.02],
    ['103512', 'Enhetschef funktionsnedsättning', 25, 0.75, ['J'], 0.0, 51400, null, 0.36, 50, 0.16],
    ['104011', 'Rektor', 45, 0.80, ['J', 'K'], 0.2, 61600, 72700, 0.34, 49, 0.26],
    ['104012', 'Chef förskola och fritid', 25, 0.95, ['J'], 0.0, 59500, null, 0.29, 47, 0.16],
    ['105010', 'Chef teknik och samhällsbyggnad', 25, 0.70, ['I', 'J'], 0.7, 60700, 64900, 0.16, 45, 0.00],
    ['109090', 'Chef övrig verksamhet', 15, 0.70, ['J'], 0.0, 65900, null, 0.27, 47, 0.18],
    ['151010', 'Handläggare övergripande', 25, 0.70, ['G', 'J'], 0.4, 47500, 63800, 0.15, 44, 0.15],
    ['151011', 'Ekonom', 35, 0.65, ['F', 'G'], 0.7, 44900, 48200, 0.27, 44, 0.27],
    ['151013', 'Kommunikatör', 30, 0.75, ['F', 'G'], 0.7, 44400, 46600, 0.27, 43, 0.01],
    ['151014', 'IT-handläggare', 45, 0.25, ['G', 'H'], 0.4, 49100, 58600, 0.25, 46, 0.21],
    ['151015', 'Upphandlare', 15, 0.45, ['G', 'H'], 0.5, 39400, 47500, 0.33, 39, 0.17],
    ['151016', 'Handläggare medborgarservice', 11, 0.90, ['G'], 0.0, 43800, null, 0.40, 41, 0.03],
    ['151017', 'Miljöhandläggare', 17, 0.80, ['H'], 0.0, 49200, null, 0.33, 43, 0.02],
    ['151018', 'Jurist', 8, 1.00, ['J'], 0.0, 61400, null, 0.23, 51, 0.27],
    ['151019', 'Arkivarie', 7, 0.70, ['F'], 0.0, 40200, null, 0.29, 44, 0.15],
    ['151020', 'Nämndsekreterare', 8, 0.80, ['G'], 0.0, 52000, null, 0.29, 47, 0.24],
    ['151023', 'Handläggare socialtjänst', 40, 0.85, ['F', 'G'], 0.7, 41600, 47500, 0.30, 47, -0.02],
    ['151024', 'Handläggare skola', 40, 0.85, ['F', 'G'], 0.4, 41700, 46700, 0.41, 46, 0.26],
    ['151025', 'Trafikhandläggare', 25, 0.55, ['G', 'H'], 0.4, 47500, 49900, 0.30, 47, 0.24],
    ['151026', 'Handläggare fastighet', 15, 0.65, ['G'], 0.0, 51200, null, 0.30, 46, 0.21],
    ['151090', 'Handläggare övrigt', 40, 0.75, ['G', 'H'], 0.4, 46200, 48500, 0.31, 43, 0.00],
    ['152010', 'Administratör', 7, 0.85, ['C'], 0.0, 31200, null, 0.24, 41, 0.20],
    ['152011', 'Ekonomiadministratör', 12, 0.90, ['D'], 0.0, 34300, null, 0.21, 47, 0.17],
    ['152012', 'Löneadministratör', 30, 0.85, ['D', 'E'], 0.5, 32600, 35100, 0.28, 43, 0.19],
    ['152013', 'Administratör kommunikation', 20, 0.90, ['D'], 0.0, 33100, null, 0.20, 45, 0.01],
    ['152014', 'IT-administratör', 4, 0.75, ['C'], 0.0, 38300, null, 0.17, 48, 0.21],
    ['152015', 'Administratör socialtjänst', 85, 0.90, ['D'], 0.0, 35600, null, 0.27, 43, 0.13],
    ['152016', 'Administratör skola', 40, 0.90, ['C'], 0.0, 37800, null, 0.29, 43, 0.25],
    ['152020', 'Administratör teknik och fastighet', 8, 0.85, ['C'], 0.0, 32500, null, 0.39, 39, 0.02],
    ['152090', 'Administratör övrigt', 25, 0.75, ['C', 'D'], 0.5, 34200, 38400, 0.25, 42, 0.20],
    ['204510', 'Psykolog', 14, 0.85, ['G'], 0.0, 48400, null, 0.34, 42, 0.20],
    ['206011', 'Distriktssköterska', 9, 1.00, ['H'], 0.0, 43200, null, 0.39, 48, 0.15],
    ['206014', 'Sjuksköterska äldreomsorg', 10, 1.00, ['H'], 0.0, 50000, null, 0.21, 51, -0.02],
    ['206019', 'Skolsköterska', 25, 1.00, ['G'], 0.0, 46600, null, 0.22, 47, 0.25],
    ['206090', 'Sjuksköterska', 80, 0.85, ['G'], 0.0, 40700, null, 0.37, 44, 0.14],
    ['207008', 'Specialistundersköterska', 25, 1.00, ['E'], 0.0, 37900, null, 0.24, 45, 0.24],
    ['207009', 'Undersköterska hemtjänst', 230, 0.75, ['D'], 0.0, 33700, null, 0.32, 42, 0.00],
    ['207011', 'Undersköterska särskilt boende', 401, 0.85, ['D'], 0.0, 33200, null, 0.32, 44, 0.14],
    ['207024', 'Vårdbiträde särskilt boende', 45, 0.80, ['B'], 0.0, 29000, null, 0.33, 39, 0.20],
    ['207029', 'Vårdbiträde hemtjänst', 35, 0.70, ['B'], 0.0, 29600, null, 0.25, 37, 0.25],
    ['207090', 'Biträdesarbete övrigt', 105, 0.65, ['B'], 0.0, 27300, null, 0.26, 37, 0.01],
    ['301010', 'Arbetsterapeut', 25, 0.80, ['G'], 0.0, 40600, null, 0.20, 43, 0.11],
    ['301011', 'Fysioterapeut', 20, 0.85, ['G'], 0.0, 44000, null, 0.33, 43, 0.17],
    ['301012', 'Arbetsterapibiträde', 25, 0.80, ['D', 'E'], 0.4, 36000, 37800, 0.23, 43, 0.20],
    ['301014', 'Logoped', 4, 1.00, ['F'], 0.0, 43300, null, 0.08, 46, 0.02],
    ['351008', 'Socialsekreterare barn och unga', 65, 0.95, ['H'], 0.0, 39600, null, 0.39, 45, 0.20],
    ['351009', 'Socialsekreterare ekonomiskt bistånd', 60, 0.90, ['G'], 0.0, 40500, null, 0.39, 43, 0.24],
    ['351010', 'Socialsekreterare övrigt', 145, 0.80, ['G', 'H'], 0.3, 42600, 44900, 0.30, 45, 0.17],
    ['351011', 'Fältsekreterare', 9, 0.70, ['F'], 0.0, 36200, null, 0.23, 46, -0.02],
    ['351012', 'Socialsekreterare vuxna och LSS', 75, 0.85, ['G'], 0.0, 41700, null, 0.32, 46, 0.16],
    ['351015', 'Behandlingsassistent', 30, 0.70, ['E'], 0.0, 35500, null, 0.36, 43, 0.15],
    ['351016', 'Arbetsmarknadskonsulent', 14, 0.75, ['F'], 0.0, 41000, null, 0.21, 46, 0.11],
    ['351031', 'Stödassistent gruppboende', 265, 0.75, ['D'], 0.0, 32300, null, 0.31, 43, 0.00],
    ['351032', 'Stödassistent dagverksamhet', 60, 0.75, ['D'], 0.0, 33700, null, 0.24, 43, 0.18],
    ['351033', 'Stödbiträde', 55, 0.65, ['B'], 0.0, 28100, null, 0.29, 37, 0.20],
    ['351040', 'Personlig assistent', 30, 0.65, ['C'], 0.0, 30400, null, 0.29, 43, 0.03],
    ['352010', 'Kurator', 25, 0.80, ['G'], 0.0, 46100, null, 0.27, 46, 0.01],
    ['352090', 'Kurativt arbete övrigt', 4, 1.00, ['G'], 0.0, 39900, null, 0.24, 46, 0.19],
    ['401009', 'Lärare grundskola F-3', 180, 0.95, ['F'], 0.0, 42100, null, 0.33, 43, 0.22],
    ['401010', 'Lärare grundskola 4-6', 150, 0.70, ['F', 'G'], 0.2, 43500, 53700, 0.38, 45, 0.18],
    ['401011', 'Lärare grundskola 7-9', 120, 0.65, ['F'], 0.0, 44500, null, 0.36, 45, 0.02],
    ['401012', 'Lärare gymnasieskola', 100, 0.65, ['G'], 0.0, 47000, null, 0.32, 45, 0.27],
    ['401013', 'Yrkeslärare gymnasieskola', 30, 0.55, ['G'], 0.0, 44600, null, 0.31, 45, 0.19],
    ['401017', 'Specialpedagog', 45, 0.90, ['G'], 0.0, 50300, null, 0.27, 44, 0.03],
    ['401018', 'SFI-lärare', 6, 0.85, ['G'], 0.0, 41800, null, 0.15, 49, -0.02],
    ['402010', 'Förskollärare', 295, 0.95, ['F'], 0.0, 38600, null, 0.34, 44, 0.20],
    ['402011', 'Lärare i fritidshem', 70, 0.60, ['F'], 0.0, 39300, null, 0.33, 45, 0.20],
    ['402090', 'Lärararbete övrigt', 15, 0.80, ['E', 'F'], 0.4, 37700, 44500, 0.42, 43, 0.20],
    ['403010', 'Barnskötare', 355, 0.95, ['C'], 0.0, 29600, null, 0.36, 41, 0.00],
    ['403011', 'Dagbarnvårdare', 7, 1.00, ['D'], 0.0, 33600, null, 0.14, 44, 0.23],
    ['403013', 'Instruktör', 13, 0.65, ['E'], 0.0, 36200, null, 0.55, 37, 0.22],
    ['403014', 'Studie- och yrkesvägledare', 16, 0.75, ['F'], 0.0, 40000, null, 0.36, 44, 0.27],
    ['403015', 'Lärarassistent', 20, 0.60, ['C'], 0.0, 33400, null, 0.31, 42, 0.01],
    ['403016', 'Elevassistent', 195, 0.70, ['C', 'D'], 0.6, 30700, 32200, 0.30, 42, 0.26],
    ['403090', 'Skolarbete övrigt', 12, 0.50, ['E'], 0.0, 34000, null, 0.26, 45, 0.27],
    ['451011', 'Kulturskolelärare', 25, 0.75, ['E', 'F'], 0.3, 37600, 39500, 0.30, 44, 0.25],
    ['451014', 'Museiarbete', 15, 0.70, ['C'], 0.0, 28000, null, 0.48, 35, 0.02],
    ['451015', 'Bibliotekarie', 35, 0.75, ['F'], 0.0, 37000, null, 0.26, 42, 0.14],
    ['451016', 'Biblioteksassistent', 4, 1.00, ['B'], 0.0, 30100, null, 0.28, 35, 0.04],
    ['452010', 'Fritidskonsulent', 4, 0.50, ['E'], 0.0, 43500, null, 0.17, 45, 0.21],
    ['452011', 'Fritidsledare', 75, 0.55, ['C', 'F'], 0.2, 32700, 36700, 0.35, 44, -0.02],
    ['452014', 'Badpersonal', 13, 0.55, ['C'], 0.0, 32000, null, 0.26, 39, 0.16],
    ['501010', 'Samhällsplanerare', 35, 0.70, ['H', 'I'], 0.3, 46100, 57400, 0.33, 47, 0.19],
    ['501011', 'Bygglovshandläggare', 4, 1.00, ['H'], 0.0, 45200, null, 0.09, 45, 0.25],
    ['501012', 'Byggnadsinspektör', 5, 0.00, ['H'], 0.0, 45800, null, 0.19, 35, 0.00],
    ['501013', 'Miljöinspektör', 12, 0.65, ['H'], 0.0, 41400, null, 0.27, 45, 0.21],
    ['502010', 'Systemutvecklare', 18, 0.55, ['G', 'H'], 0.6, 43700, 46100, 0.39, 45, 0.19],
    ['502012', 'Trafikingenjör', 19, 0.40, ['I'], 0.0, 65600, null, 0.40, 50, 0.21],
    ['502013', 'Fastighetsingenjör', 35, 0.40, ['G', 'H'], 0.4, 49700, 52200, 0.38, 44, 0.01],
    ['502014', 'VA-ingenjör', 35, 0.45, ['G', 'H'], 0.6, 44400, 53700, 0.33, 45, 0.25],
    ['503010', 'IT-tekniker', 16, 0.10, ['E'], 0.0, 34700, null, 0.30, 38, 0.22],
    ['503012', 'Drifttekniker', 20, 0.00, ['E'], 0.0, 38400, null, 0.24, 48, 0.20],
    ['503090', 'Tekniker övrigt', 14, 0.05, ['D'], 0.0, 37400, null, 0.21, 42, 0.02],
    ['521012', 'Anläggningsarbetare', 13, 0.10, ['C'], 0.0, 34800, null, 0.37, 43, 0.24],
    ['521013', 'Hantverkare', 6, 0.00, ['D'], 0.0, 34600, null, 0.26, 42, 0.16],
    ['521015', 'Vaktmästare', 45, 0.20, ['B', 'C'], 0.3, 30700, 33200, 0.31, 37, 0.27],
    ['521018', 'Trädgårdsarbetare', 19, 0.65, ['C', 'D'], 0.7, 31300, 33700, 0.27, 46, -0.02],
    ['601010', 'Kock', 115, 0.70, ['C'], 0.0, 31500, null, 0.26, 40, 0.17],
    ['651010', 'Lokalvårdare', 105, 0.85, ['A'], 0.0, 28300, null, 0.28, 38, 0.19],
]);
// Oförklarat gap för kvinnor (andel av lönen) per AID, i fyra blandade yrken med minst 40 personer.
/** @type {Readonly<Record<string, number>>} */
export const _SD_GAP = Object.freeze({ '401011': -0.025, '401012': -0.04, '207090': -0.035, '601010': -0.03 });
// Likvärdigt arbete: ett mansdominerat tekniskt yrke (hog) med högre lön än ett kvinnodominerat vårdyrke (lag) i
// samma BAS-intervall.
export const _SD_LIKVARDIGT = Object.freeze({ hog: '503090', lag: '207011', bas: 'D' });

export function genereraStortDemo() {
    // Samma slags seedade slump som genereraTestdata, med ett eget frö: samma underlag vid varje anrop.
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

// ---- Påhittad jämförelsestatistik och ett ställningstagande ur demots löner ----
// Statistiken har en rad per yrke och BAS-intervall, eftersom statistiken bara matchar en rad i samma intervall (eller
// en rad utan intervall). Medianen är yrkets nivå i intervallet gånger (1 + påslaget). Var fjärde yrke har ett
// påslag kring noll, så att ungefär en fjärdedel av grupperna ligger över statistiken och inte alla ser underbetalda ut. Ingen verklig källa efterliknas.
const _sdAvrunda = (x, steg) => Math.round(x / steg) * steg;

export function genereraStortDemoStatistik() {
    // Eget frö: samma statistik vid varje anrop, oberoende av lönerna.
    let seed = 126;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const rader = [];
    for (const [aid, namn, , andelKv, basLista, , nivaL, nivaH, spridning, , paslag] of _SD_YRKEN) {
        basLista.forEach((bas, i) => {
            const niva = i === 0 ? nivaL : /** @type {number} */ (nivaH);
            const median = _sdAvrunda(niva * (1 + paslag), 100);
            const forskjutning = Math.floor(rnd() * 11) - 5;   // −5 … +5 procentenheter
            rader.push({
                aid: _normaliseraPolicyAid(aid), aidFull: `${aid} ${namn}`, bas,
                median, p10: _sdAvrunda(median * (1 - 0.45 * spridning), 100), p90: _sdAvrunda(median * (1 + 0.55 * spridning), 100),
                nKv: null, nMa: null, andelKv: Math.max(0, Math.min(100, Math.round(andelKv * 100) + forskjutning)),
            });
        });
    }
    return rader;
}

// Ställningstagandet per BAS-intervall A–K räknas ur demots löner: medianen avrundad till 500 kr, P10 och P90 avrundade
// till 100 kr; ett intervall under k-tröskeln (i dag K) får närmaste lägre intervalls rad gånger 1,10. I några stora
// intervall ligger ställningstagandet 4–5 % över demots median, så att grupper hamnar under det och Prioritering och
// Lönepolitik har något att visa.
/** @type {Readonly<Record<string, number>>} */
const _SD_POLICYLYFT = Object.freeze({ C: 1.04, F: 1.05, H: 1.04 });
// k är den inställda tröskeln (appen skickar kInstalld()): raderna står i exporterna.
export function _sdStallningstagande(data, k = 10) {
    /** @type {{aid: null, bas: string, p10: number, med: number, p90: number}|null} */
    let senast = null;   // närmaste lägre intervall som räknats ur sina egna löner
    return _SD_BAS.flatMap(bas => {
        const loner = data.filter(r => r.bas === bas).map(r => r.lon);
        // En rad ur färre än k personer skulle röja gruppens löner (S4): den stegas i stället från närmaste lägre rad.
        if (loner.length < k) return senast ? [{ aid: null, bas, p10: _sdAvrunda(senast.p10 * 1.1, 100),
            med: _sdAvrunda(senast.med * 1.1, 500), p90: _sdAvrunda(senast.p90 * 1.1, 100) }] : [];
        senast = {
            aid: null, bas,
            p10: _sdAvrunda(kvantil(loner, 0.1), 100),
            med: _sdAvrunda(median(loner) * (_SD_POLICYLYFT[bas] || 1), 500),
            p90: _sdAvrunda(kvantil(loner, 0.9), 100),
        };
        return [senast];
    });
}

/**
 * Självdiagnostiken på demot (genereraDemodata, som genereraTestdata): räknar verktyget fram det som lagts in? Den råa skillnaden ska
 * vara negativ, den oförklarade nära −3 % och säkerställd, BAS-effekten 5–25 % per bokstavssteg, R² över 0,30,
 * underlagets kvalitet inte kritisk och fem BAS-intervall. Utan tröskel (k = 1): det är verktygets egen testdata.
 * @param {{rader: any[], reg: any, underlag: {status: string}|null, antalBas: number}} m
 *   reg: huvudregressionen på raderna (med `error` när den inte kunde skattas)
 * @param {{nivaFl: string, underlagEtikett: (status: string) => string, pText: (p: number) => string}} ord
 * @returns {{name: string, expected: string, actual: string, pass: boolean}[]}
 */
export function demodiagnostik({ rader, reg, underlag, antalBas }, ord) {
    const tests = [];
    // Den råa skillnaden ska vara märkbart negativ (kvinnor yngre + lägre BAS = lägre lön)
    const rawGap = konsMedianer(rader).gapPct;
    tests.push({ name: 'Den råa löneskillnaden är negativ (kvinnor lägre lön)', expected: '< -3%', actual: svPct(rawGap, 2), pass: rawGap != null && rawGap < -3 });
    // Den oförklarade skillnaden (efter ålder + BAS) ska vara nära den inlagda effekten −3 %
    if (!reg.error) {
        tests.push({ name: 'Oförklarad skillnad nära −3 % (inlagd könseffekt)', expected: '-1% till -5%', actual: svPct(reg.konPct, 2), pass: reg.konPct > -5 && reg.konPct < -1 });
        tests.push({ name: 'Oförklarad skillnad är statistiskt signifikant (p < 0,05)', expected: 'p < 0,05', actual: ord.pText(reg.pValue), pass: reg.pValue < 0.05 });
        // BAS-effekten: nivån i högsta BAS mot referensen, utslagen per bokstavssteg
        if (reg.basEffekter && reg.basEffekter.length) {
            const sista = reg.basEffekter[reg.basEffekter.length - 1];
            const rang = basRangordning(reg.basList);
            const steg = rang(sista.bas) - rang(reg.basRef);
            const perSteg = (Math.exp(Math.log(1 + sista.pct / 100) / steg) - 1) * 100;
            tests.push({ name: 'BAS-effekt är signifikant positiv (omkring 10–15 % per steg)', expected: '+5 % till +25 % per steg',
                actual: svPct(perSteg, 2) + ` (BAS ${sista.bas} mot ${reg.basRef}: ${svPct(sista.pct, 1)})`, pass: perSteg > 5 && perSteg < 25 });
        }
        tests.push({ name: 'R² > 30 % (modellen förklarar en betydande andel av lönerna)', expected: 'R² > 0,30', actual: svPct(reg.R2 * 100, 2), pass: reg.R2 > 0.30 });
    } else {
        tests.push({ name: 'Regression kunde estimeras', expected: 'OK', actual: 'Fel: ' + reg.error, pass: false });
    }
    // Underlagets kvalitet får inte vara kritisk för testdatan
    if (underlag) tests.push({ name: 'Underlagets kvalitet är inte kritisk (testdata)', expected: 'OK eller Varning', actual: ord.underlagEtikett(underlag.status), pass: underlag.status !== 'kritisk' });
    tests.push({ name: `Antal unika ${ord.nivaFl} = 5 (testdatan har A–E)`, expected: '5', actual: antalBas.toString(), pass: antalBas === 5 });
    return tests;
}

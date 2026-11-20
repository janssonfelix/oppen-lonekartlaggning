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

// ===================================================================================
// Differensprovet i invarianten (tests/helpers/ktroskel-invariant.js): samma rest, men på tabellerna som faktiskt
// lämnar verktyget, så som riggen samlar in dem (samlaUtdata), inte på lib-resultaten.
//
// En tabell är ett namn (utdatans väg), ett blad (Excel-bladet eller tabellens caption, annars tomt) och rader med
// celler. Vilka kolumner som är antal och medel, och vilken rad som är totalen, gissas inte ur rubrikerna: varje
// rubrikrad med ett ord för medel, summa eller kostnad (KRAVER_DEKLARATION) ska ha en deklaration i riggen
// (DIFFERENS_DEKLARATIONER i tests/helpers/ktroskel-rigg.js), antingen med sina kolumner eller som "inget att dela
// upp" med skäl. En rubrikrad utan deklaration fäller provet. Medianer och percentiler deklareras aldrig som mått: de
// går inte att dela upp linjärt.
// ===================================================================================

/**
 * Rubrikord som kräver en deklaration: en kolumn med medel, summa eller kostnad kan vara en total med delar. Med liten
 * eller stor begynnelsebokstav, inte versaler: Att göra-listans prioritet MEDEL är ingen kolumn.
 */
export const KRAVER_DEKLARATION = /[Mm]edel|[Ss]umma|[Kk]ostnad|[Ll]önesumma/;

/**
 * Ett tal ur en cell som exporten skriver det: tusentalsavgränsare och enhet bort, decimalkomma som punkt. Null för
 * en tom cell, ett streck och allt som inte bara är ett tal (med enhet).
 * @param {unknown} cell
 */
export function tal(cell) {
    if (typeof cell === 'number') return isFinite(cell) ? cell : null;
    const s = String(cell ?? '').replace(/[\s  ]/g, '').replace(/[−–]/g, '-')
        .replace(/(kr\/mån|kr\/år|kr|%|år|st|personer)$/i, '').replace(',', '.');
    return /^[-+]?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

/** En rubrikrad: minst två ifyllda celler och inget tal bland dem. */
export function arRubrikrad(rad) {
    const ifyllda = rad.map(c => String(c ?? '').trim()).filter(Boolean);
    return ifyllda.length >= 2 && ifyllda.every(c => tal(c) === null);
}

/**
 * Tabellerna i en utdata skriven som text med celler åtskilda av " | " (Excel som riggen fångar den, CSV, diagramdata).
 * En rad "[Blad]" börjar ett nytt Excel-blad. En text utan en enda rad med två celler har ingen tabell.
 * @param {string} namn
 * @param {string} text
 */
export function tabellerUrText(namn, text) {
    const ut = [];
    let akt = { namn, blad: '', rader: [] };
    for (const rad of String(text).split('\n')) {
        const blad = /^\[([^\]|]+)\]$/.exec(rad);
        if (blad) { ut.push(akt); akt = { namn, blad: blad[1], rader: [] }; continue; }
        akt.rader.push(rad.split(' | ').map(c => c.trim()));
    }
    ut.push(akt);
    return ut.filter(t => t.rader.some(r => r.length >= 2));
}

const _avkoda = s => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/**
 * Tabellerna i en HTML-text (Word-utkastet, rapportmodellen, rapportunderlaget, utskriften), med colspan utvidgad
 * till tomma celler som verktygets egen CSV. Bladet är tabellens caption. Verktygets HTML har inga tabeller i tabeller.
 * @param {string} namn
 * @param {string} html
 */
export function tabellerUrHtml(namn, html) {
    const ut = [];
    for (const [tabell] of String(html).matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
        const caption = /<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(tabell);
        const rader = [];
        for (const [tr] of tabell.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
            const rad = [];
            for (const m of tr.matchAll(/<t([hd])\b([^>]*)>([\s\S]*?)<\/t\1>/gi)) {
                rad.push(_avkoda(m[3]).replace(/(\d)[\s  ](?=\d)/g, '$1'));
                const span = Number(/colspan="?(\d+)/i.exec(m[2])?.[1] || 1);
                for (let i = 1; i < span; i++) rad.push('');
            }
            if (rad.length) rader.push(rad);
        }
        ut.push({ namn, blad: caption ? _avkoda(caption[1]) : '', rader });
    }
    return ut;
}

/**
 * Alla tabeller i riggens utdata: texterna med " | ", HTML-tabellerna och tabellerna som riggen läste ur flikarna i
 * exportläget (`utdata.tabeller`). Skärmen utan exportläget hoppas över: den maskerar inget (ADR-51). Flikarna i
 * exportläget som löptext hoppas också över; deras tabeller finns i `utdata.tabeller`.
 * @param {any} utdata riggens [namn, text]-par, med `tabeller`
 */
export function tabellerIUtdata(utdata) {
    const ut = [];
    for (const [namn, text] of utdata) {
        if (namn === 'skärm: alla flikar' || namn === 'skärm i exportläget: alla flikar') continue;
        if (/<table\b/i.test(text)) ut.push(...tabellerUrHtml(namn, text));
        ut.push(...tabellerUrText(namn, text.replace(/<table\b[\s\S]*?<\/table>/gi, '')));
    }
    ut.push(...(utdata.tabeller || []));
    return ut;
}

const _kol = (rubrik, kolumn) => (typeof kolumn === 'number' ? kolumn
    : kolumn instanceof RegExp ? rubrik.findIndex(c => kolumn.test(c)) : rubrik.indexOf(kolumn));
/** En rads antal och medel för ett mått (en summa som medel per person); null där cellen inte har ett tal. */
function _del(m, r) {
    let n = tal(r[m.iAntal]);
    if (m.iAndel >= 0 && n !== null) {
        const a = tal(r[m.iAndel]);
        const kv = a === null ? null : Math.round(n * a / 100);
        n = kv === null ? null : m.antal.komplement ? n - kv : kv;
    }
    const v = tal(r[m.i]);
    if (v === null || n === null) return { n, medel: null };
    return { n, medel: m.typ === 'summa' ? (n > 0 ? v / n : null) : v };
}
/**
 * Lämnar totalen minus någon delmängd av de övriga raderna precis gruppen g: antalet g.n och medlet inom GRANS?
 * Delmängderna räknas upp per antal (dynamisk programmering över antalet, med lönesummorna för varje antal).
 */
function _delmangdLamnar(tot, ovriga, g) {
    const c = tot.n - g.n;
    if (c <= 0) return false;
    const mal = tot.n * tot.medel - g.n * g.medel, tol = GRANS * g.n * g.medel;
    let lag = new Map([[0, new Set([0])]]);
    for (const x of ovriga) {
        if (x.n <= 0 || x.n > c) continue;
        const ny = new Map([...lag].map(([n, s]) => [n, new Set(s)]));
        for (const [n, summor] of lag) {
            if (n + x.n > c) continue;
            const mot = ny.get(n + x.n) ?? new Set();
            for (const s of summor) if (mot.size < 5000) mot.add(Math.round(s + x.n * x.medel));
            ny.set(n + x.n, mot);
        }
        lag = ny;
    }
    return [...(lag.get(c) ?? [])].some(s => Math.abs(mal - s) <= tol);
}
const _passar = (d, t, rubrik) => d.vag.test(t.namn) && (!d.blad || d.blad.test(t.blad)) && d.rubrik.test(rubrik.join(' | '));
const _galler = (d, k) => !d.trosklar || d.trosklar.includes(k);

/**
 * Differensprovet över tabeller med deklarationer.
 *
 * En deklaration: `namn`; `vag` (utdatans namn), `blad` (valfri) och `rubrik` (rubrikraden med cellerna åtskilda av
 * " | "), som alla prövas som reguljära uttryck; sedan antingen `inget` (skälet till att tabellen inte har något att
 * dela upp) eller `antal` (rubriken för antalet), `etikett` (radens etikett, standard första kolumnen), `total` (den
 * etikett som är totalen), `delar` (valfri: de etiketter som är delar, annars alla övriga rader) och `matt`: en lista
 * med { kolumn, typ: 'medel' | 'summa', antal?: { kolumn } | { andel, komplement? } } — ett mått per kön har sitt
 * antal i en egen kolumn eller som andel kvinnor av antalet (komplement: männen). En kolumn anges med sin rubrik,
 * ett reguljärt uttryck eller ett index. `trosklar` (valfri) begränsar deklarationen till vissa trösklar;
 * `kanSaknaTotal` säger att tabellen vid den här tröskeln kan sakna en total att pröva.
 *
 * För varje rubrikrad som en deklaration med mått känner igen läses raderna under den, tills en rad saknar ett
 * heltal i antalet. Totalen är den rad vars etikett matchar `total`. För varje mått räknas resten: totalen minus de
 * delar som har ett värde, i antal och medel (`rest`); en summa räknas först om till medel per person. En rest med 1
 * till k − 1 personer är ett fynd: dess medel går att räkna fram. `kanda` är riggens små grupper ({namn, n, medel});
 * ett fynd säger vilken av dem resten motsvarar (samma antal och medel inom GRANS), så att meddelandet går att följa.
 *
 * `total: 'delmängd'` är för en tabell utan uttalad totalrad: varje rad prövas som total för en delmängd av de övriga
 * (en rad vars antal är summan av andras), och ett fynd är en rad som minus någon delmängd lämnar precis en av riggens
 * små grupper, i antal och medel inom GRANS. Riggens kunskap om underlaget avgör alltså här om en rest är en liten
 * grupp: ett antal som råkar gå jämnt upp ger annars ett medel som inte motsvarar något.
 *
 * Provet fäller också (i `odeklarerade`) en rubrikrad med ett ord ur KRAVER_DEKLARATION som ingen deklaration känner
 * igen, och (i `oanvanda`) en deklaration som inte känner igen någon tabell, eller med mått inte prövade någon total,
 * vid den här tröskeln: en deklaration ska inte tyst sluta gälla. `fel` är deklarationer som inte stämmer med tabellen
 * (en kolumn saknas, delarna har fler personer än totalen).
 *
 * @param {Array<{namn:string, blad:string, rader:string[][]}>} tabeller
 * @param {any[]} deklarationer
 * @param {{k:number, kanda?:Array<{namn:string, n:number, medel:number}>}} opt
 */
export function differensprov(tabeller, deklarationer, { k, kanda = [] }) {
    const fynd = [], odeklarerade = new Set(), fel = [];
    const traffar = new Map(deklarationer.map(d => [d, 0])), provade = new Map(deklarationer.map(d => [d, 0]));
    for (const t of tabeller) {
        t.rader.forEach((rubrik, h) => {
            if (!arRubrikrad(rubrik)) return;
            const d = deklarationer.find(x => _galler(x, k) && _passar(x, t, rubrik));
            if (!d) {
                if (rubrik.some(c => c.length <= 80 && KRAVER_DEKLARATION.test(c)))
                    odeklarerade.add(`${t.namn}${t.blad ? ` [${t.blad}]` : ''}: rubrikraden "${rubrik.join(' | ')}" måste deklareras i `
                        + 'DIFFERENS_DEKLARATIONER (tests/helpers/ktroskel-rigg.js), med sina kolumner eller som inget att dela upp, med skäl');
                return;
            }
            traffar.set(d, traffar.get(d) + 1);
            if (d.inget) return;
            const iAntal = _kol(rubrik, d.antal), iEtikett = _kol(rubrik, d.etikett ?? 0);
            const matt = d.matt.map(m => ({ ...m, i: _kol(rubrik, m.kolumn),
                iAntal: m.antal?.kolumn != null ? _kol(rubrik, m.antal.kolumn) : iAntal,
                iAndel: m.antal?.andel != null ? _kol(rubrik, m.antal.andel) : -1 }));
            const saknas = [[d.antal, iAntal], ...matt.map(m => [m.kolumn, m.i]), ...matt.map(m => [m.antal?.kolumn ?? m.antal?.andel, m.antal ? Math.max(m.iAntal, m.iAndel) : 0])]
                .filter(([, i]) => i < 0).map(([c]) => c);
            if (saknas.length) { fel.push(`${d.namn}: kolumnen ${saknas.join(', ')} finns inte i "${rubrik.join(' | ')}" (${t.namn})`); return; }
            const rader = [];
            for (let r = h + 1; r < t.rader.length; r++) {
                const n = tal(t.rader[r][iAntal]);
                if (n === null || !Number.isInteger(n)) break;
                rader.push(t.rader[r]);
            }
            const plats = `${t.namn}${t.blad ? ` [${t.blad}]` : ''}`;
            if (d.total === 'delmängd') {
                // Ingen uttalad total: varje rad prövas som total för en delmängd av de övriga, mot riggens små grupper.
                for (const m of matt) {
                    const varden = rader.map(r => ({ r, ..._del(m, r) })).filter(x => x.n !== null && x.medel !== null);
                    if (varden.length < 2) continue;
                    provade.set(d, provade.get(d) + 1);
                    for (const tot of varden) for (const g of kanda) {
                        if (!(g.n < k) || !_delmangdLamnar(tot, varden.filter(x => x !== tot), g)) continue;
                        fynd.push({ deklaration: d.namn, vag: t.namn, blad: t.blad, kolumn: m.kolumn, total: tot.r[iEtikett], n: g.n,
                            medel: Math.round(g.medel), motsvarar: [g.namn],
                            text: `${plats}, ${m.kolumn}: raden "${tot.r[iEtikett]}" minus en delmängd av de övriga raderna lämnar `
                                + `${g.n} ${g.n === 1 ? 'person' : 'personer'} med medel ${Math.round(g.medel)} (${g.namn})` });
                    }
                }
                return;
            }
            const totaler = rader.filter(r => d.total.test(r[iEtikett] ?? ''));
            if (totaler.length !== 1) return;   // ingen total i den här tabellen: inget att pröva
            const total = totaler[0];
            const delar = rader.filter(r => r !== total && (!d.delar || d.delar.test(r[iEtikett] ?? '')));
            for (const m of matt) {
                const del = r => _del(m, r);
                const tot = del(total);
                if (tot.n === null || tot.medel === null) continue;
                provade.set(d, provade.get(d) + 1);
                const visade = delar.map(del).filter(x => x.n !== null && x.medel !== null);
                const nVisade = visade.reduce((s, x) => s + x.n, 0);
                if (nVisade > tot.n) {
                    fel.push(`${d.namn}: delarna har fler personer (${nVisade}) än totalen (${tot.n}) i kolumnen ${m.kolumn} (${plats}): deklarationen stämmer inte`);
                    continue;
                }
                const r = rest(tot, visade);
                if (!r || r.n >= k) continue;
                const motsvarar = kanda.filter(g => g.n === r.n && harlett(r.medel, g.medel)).map(g => g.namn);
                fynd.push({ deklaration: d.namn, vag: t.namn, blad: t.blad, kolumn: m.kolumn, total: total[iEtikett], n: r.n,
                    medel: Math.round(r.medel), motsvarar,
                    text: `${plats}, ${m.kolumn}: raden "${total[iEtikett]}" minus ${visade.length} visade rader `
                        + `lämnar ${r.n} ${r.n === 1 ? 'person' : 'personer'} med medel ${Math.round(r.medel)}`
                        + (motsvarar.length ? ` (${motsvarar.join(', ')})` : ' (ingen känd liten grupp i underlaget)') });
            }
        });
    }
    const oanvanda = deklarationer.filter(d => _galler(d, k) && (!traffar.get(d) || (!d.inget && !d.kanSaknaTotal && !provade.get(d))))
        .map(d => `${d.namn}: ${traffar.get(d) ? 'ingen total prövades' : 'känner inte igen någon tabell'}`);
    return { fynd, odeklarerade: [...odeklarerade].sort(), fel, oanvanda };
}

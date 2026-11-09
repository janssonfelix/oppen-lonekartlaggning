// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — förhandskontrollen av lönefilen: hur filen tolkades, rad för rad och i sammandrag, med
 * varningar, direkt efter inläsningen.
 *
 * Ren logik utan DOM och state. Appen (32-filinlasning.js) samlar under inläsningen de tio första raderna med
 * filens råvärde och verktygets tolkning, räknar kön-värdena och skickar in de använda raderna och inläsningens
 * räknare (parseStats). Här byggs det som visas (17-forhandskontroll.js): tolkningen per cell, sammandraget,
 * värdefördelningen och varningarna. Ingen tolkning görs om här — modulen beskriver bara den som redan gjorts.
 *
 * Dataskydd: tolkningen bär högst tio rader med fem till sju fält, och yrkets råvärde följer aldrig med (yrket
 * visas som verktyget sparar det, med namnmaskeringen). Varningarnas texter bär inga löner eller åldrar ur filen,
 * eftersom de också står i Att göra, vars punkter kan exporteras.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

/** Antal rader i tolkningen. */
export const FK_ANTAL_RADER = 10;
/** En medianlön över detta ser ut som en årslön. */
export const FK_ARSLON_MEDIAN = 150000;
/** En medianlön under detta ser ut som en timlön. */
export const FK_TIMLON_MEDIAN = 5000;
/** Den högsta lönen över så många gånger medianen är en orimlig spridning. */
export const FK_SPRIDNING_GANGER = 10;
export const FK_ALDER_MIN = 16;
export const FK_ALDER_MAX = 75;
/** Gruppstorleken för andelen rader i små BAS-intervall, när ingen minsta gruppstorlek skickas in. */
export const FK_SMA_GRUPP = 10;
/** Råvärden kortas till så många tecken (samma som inläsningsrapportens exempel). */
const MAX_RA = 24;
const VANLIG_BAS = /^[A-N]$/;
const ROLLER = ['bas', 'yrke', 'lon', 'alder', 'kon', 'poang', 'ansvar'];
// Ålder är valfri (ADR-64): kolumnen visas bara när den lästes.
const OBLIGATORISKA = ['bas', 'yrke', 'lon', 'kon'];
const ANSVAR_TEXT = { ledning: 'ledningsansvar', uppdrag: 'särskilt uppdrag', inget: 'inget särskilt ansvar' };

/** Gränsvärdena, för gränssnittets texter. */
export function forhandskontrollGranser() {
    return { antalRader: FK_ANTAL_RADER, arslonMedian: FK_ARSLON_MEDIAN, timlonMedian: FK_TIMLON_MEDIAN,
        spridningGanger: FK_SPRIDNING_GANGER, alderMin: FK_ALDER_MIN, alderMax: FK_ALDER_MAX, smaGrupp: FK_SMA_GRUPP };
}

const _tal = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });
function _fkTal(v) { return typeof v === 'number' && isFinite(v) ? _tal.format(v) : ''; }
function _fkKorta(v) {
    if (v == null) return '';
    const s = String(v).trim();
    return s.length > MAX_RA ? s.slice(0, MAX_RA) + '…' : s;
}
function _fkMedian(sorterade) {
    const n = sorterade.length;
    if (!n) return null;
    return n % 2 ? sorterade[(n - 1) / 2] : (sorterade[n / 2 - 1] + sorterade[n / 2]) / 2;
}
const _fkRader = n => `${n} ${n === 1 ? 'rad' : 'rader'}`;
const _fkPersoner = n => `${n} ${n === 1 ? 'person' : 'personer'}`;

/**
 * En cell: råvärdet (kortat), tolkningen, skälet till att cellen markeras (eller null) och texten som visas —
 * "rå tolkat som …" när tolkningen skiljer sig från råvärdet (med ord: gränssnittet har inga pilar).
 */
function _fkCell(roll, rad) {
    const ra = _fkKorta(rad.ra?.[roll]);
    const tolkat = rad.tolkat?.[roll];
    const status = (rad.status && rad.status[roll]) || 'ok';
    const tom = ra === '';
    const visa = (tolkatText, lika) => (tom ? '(tom)' : lika ? ra : `${ra} tolkat som ${tolkatText}`);
    if (roll === 'yrke') {
        const t = String(tolkat ?? '');
        return { 'rå': null, tolkat: t, fel: t ? null : 'saknas', text: t || '(tom)' };
    }
    if (roll === 'bas') {
        const t = String(tolkat ?? '');
        const fel = !t ? 'saknas: raden faller bort' : VANLIG_BAS.test(t) ? null : 'inte en bokstav A–N';
        return { 'rå': ra, tolkat: t, fel, text: visa(t, ra === t) };
    }
    if (roll === 'kon') {
        const t = String(tolkat ?? '');
        const kand = t === 'kvinna' || t === 'man';
        const fel = tom ? 'saknas: raden faller bort' : kand ? null : 'okänd kod: raden faller bort';
        return { 'rå': ra, tolkat: kand ? t : null, fel, text: kand ? visa(t, ra.toLowerCase() === t) : (tom ? '(tom)' : ra) };
    }
    if (roll === 'ansvar') {
        const t = ANSVAR_TEXT[tolkat] || '';
        const fel = status === 'invalid' ? 'ogiltig kod: räknas som inget särskilt ansvar' : null;
        return { 'rå': ra, tolkat: tolkat ?? null, fel, text: tom ? '(tom)' : `${ra} tolkat som ${t || ANSVAR_TEXT.inget}` };
    }
    // Tal: lön, ålder och poäng.
    const n = typeof tolkat === 'number' && isFinite(tolkat) ? tolkat : null;
    const lika = n != null && ra === String(n);
    if (roll === 'lon') {
        const fel = status === 'invalid' ? 'kan inte läsas som tal: raden faller bort'
            : tom ? 'saknas: raden faller bort' : n == null || n <= 0 ? 'noll eller negativ: raden faller bort' : null;
        return { 'rå': ra, tolkat: n, fel, text: status === 'invalid' ? ra : visa(_fkTal(n), lika) };
    }
    if (roll === 'alder') {
        if (status === 'birthyear') return { 'rå': ra, tolkat: n, fel: null, text: `${ra} tolkat som ${_fkTal(n)} år` };
        const fel = status === 'invalid' ? 'kan inte läsas som tal' : tom ? 'saknas'
            : n != null && (n < FK_ALDER_MIN || n > FK_ALDER_MAX) ? `utanför ${FK_ALDER_MIN}–${FK_ALDER_MAX} år` : null;
        return { 'rå': ra, tolkat: n, fel, text: status === 'invalid' ? ra : visa(`${_fkTal(n)} år`, lika) };
    }
    const fel = status === 'invalid' ? 'kan inte läsas som tal' : null;
    return { 'rå': ra, tolkat: n, fel, text: status === 'invalid' ? ra : visa(_fkTal(n), lika) };
}

/**
 * Bygger förhandskontrollen.
 * @param {{
 *   rader?: Array<{radnr?: number|null, anvands: boolean, ra: Object<string, any>, tolkat: Object<string, any>, status?: Object<string, string>}>,
 *   data?: Array<{bas: string, lon: number, alder: number, kon: string}>,
 *   konVarden?: Array<{'rå': string, tolkat: string|null, antal: number}>,
 *   parseStats?: Object<string, any>,
 *   headers?: string[],
 *   mappning?: Object<string, string|null>,
 *   k?: number,
 *   profil?: {namn: string, kalla: string}|null
 * }} indata - `rader`: filens första rader (råvärde, tolkning, status för lön/ålder/poäng/ansvar, om raden
 *   används); `data`: de använda raderna; `konVarden`: kön-kolumnens värden i hela filen; `mappning`: roll till rubrik
 *   som lästes; `k`: minsta gruppstorlek; `profil`: importprofilen som kände igen filen.
 */
export function byggForhandskontroll({ rader = [], data = [], konVarden = [], parseStats = {}, headers = [], mappning = {}, k = FK_SMA_GRUPP, profil = null } = {}) {
    const ps = parseStats || {};
    const roller = ROLLER.filter(r => OBLIGATORISKA.includes(r) || (mappning && mappning[r]));
    const tolkning = rader.slice(0, FK_ANTAL_RADER).map(rad => ({
        radnr: rad.radnr ?? null, anvands: !!rad.anvands,
        celler: Object.fromEntries(roller.map(r => [r, _fkCell(r, rad)])),
    }));

    // Sammandrag ur inläsningens räknare.
    const bortfall = [];
    const lagg = (kod, antal, text, exempel = []) => { if (antal > 0) bortfall.push({ kod, antal, text, exempel: [...exempel] }); };
    lagg('bas', ps.excludedNoBas || 0, 'utan BAS-intervall');
    lagg('lon', ps.excludedZeroLon || 0, 'utan lön (tom, noll eller som inte går att läsa)', ps.invalidLonExamples || []);
    lagg('kon', ps.excludedMissingKon || 0, 'utan känt kön', ps.missingKonExamples || []);
    const sammandrag = {
        totalt: ps.totalRaw || 0, anvands: data.length, bortfall,
        ogiltigLon: { antal: ps.invalidLon || 0, exempel: [...(ps.invalidLonExamples || [])] },
        ogiltigAlder: { antal: ps.invalidAlder || 0, exempel: [...(ps.invalidAlderExamples || [])] },
        fodelsear: ps.alderFromBirthYear || 0,
    };

    // Värdefördelningen i de använda raderna.
    const perBas = new Map();
    for (const r of data) perBas.set(r.bas, (perBas.get(r.bas) || 0) + 1);
    const basVarden = [...perBas.entries()].map(([bas, antal]) => ({ bas, antal })).sort((a, b) => (a.bas < b.bas ? -1 : a.bas > b.bas ? 1 : 0));
    const ovanliga = basVarden.map(b => b.bas).filter(b => !VANLIG_BAS.test(b));
    const loner = data.map(r => r.lon).filter(v => typeof v === 'number' && v > 0).sort((a, b) => a - b);
    const lon = loner.length ? { min: loner[0], median: _fkMedian(loner), max: loner[loner.length - 1] } : null;
    const aldrar = data.map(r => r.alder).filter(v => typeof v === 'number' && v > 0).sort((a, b) => a - b);
    const utanfor = aldrar.filter(a => a < FK_ALDER_MIN || a > FK_ALDER_MAX).length;
    const alder = aldrar.length ? { min: aldrar[0], max: aldrar[aldrar.length - 1], utanfor } : null;
    const grans = typeof k === 'number' && k > 0 ? k : FK_SMA_GRUPP;
    const sma = basVarden.filter(b => b.antal < grans);
    const smaRader = sma.reduce((s, b) => s + b.antal, 0);
    const fordelning = {
        bas: { varden: basVarden, ovanliga },
        kon: konVarden.map(v => ({ 'rå': _fkKorta(v['rå']), tolkat: v.tolkat ?? null, antal: v.antal })),
        lon, alder,
        smaBas: { k: grans, bas: sma.map(b => b.bas), rader: smaRader, andel: data.length ? smaRader / data.length : 0 },
    };

    // Varningarna. Texterna bär inga löner eller åldrar ur filen (de kan följa med Att göra ut ur verktyget).
    const varningar = [];
    const varna = (kod, niva, text) => varningar.push({ kod, niva, text });
    if (lon && lon.median > FK_ARSLON_MEDIAN) {
        varna('lon-arslon', 'fel', `Medianlönen är över ${_fkTal(FK_ARSLON_MEDIAN)} kr och ser ut som en årslön. Verktyget räknar med månadslön: kontrollera lönekolumnen.`);
    } else if (lon && lon.median < FK_TIMLON_MEDIAN) {
        varna('lon-timlon', 'fel', `Medianlönen är under ${_fkTal(FK_TIMLON_MEDIAN)} kr och ser ut som en timlön. Verktyget räknar med månadslön: kontrollera lönekolumnen.`);
    } else if (lon && lon.max > FK_SPRIDNING_GANGER * lon.median) {
        varna('lon-spridning', 'varning', `Den högsta lönen är mer än ${FK_SPRIDNING_GANGER} gånger medianlönen: kontrollera om några löner är årslöner eller har fel enhet.`);
    }
    if (data.length && !data.some(r => typeof r.alder === 'number' && r.alder > 0)) {
        varna('alder-saknas', 'varning', 'Ålder saknas: analysen körs utan åldersjustering; Ålder & karriär visas inte.');
    }
    if (sammandrag.fodelsear > 0) {
        varna('alder-fodelsear', 'varning', `Åldern har räknats ut ur födelseår för ${_fkRader(sammandrag.fodelsear)}: kontrollera att ålderskolumnen verkligen är födelseår.`);
    }
    if (utanfor > 0) {
        varna('alder-utanfor', 'varning', `${_fkPersoner(utanfor)} har en ålder utanför ${FK_ALDER_MIN}–${FK_ALDER_MAX} år: kontrollera ålderskolumnen.`);
    }
    if (sammandrag.ogiltigAlder.antal > 0) {
        varna('alder-ogiltig', 'varning', `${_fkRader(sammandrag.ogiltigAlder.antal)} har en ålder som inte går att läsa som tal.`);
    }
    if (ovanliga.length) {
        const visa = ovanliga.slice(0, 5).map(b => _fkKorta(b)).join(', ') + (ovanliga.length > 5 ? ' …' : '');
        varna('bas-ovanlig', 'varning', `${ovanliga.length} ${ovanliga.length === 1 ? 'BAS-värde är' : 'BAS-värden är'} inte en bokstav A–N (${visa}): kontrollera BAS-kolumnen.`);
    }
    if ((ps.excludedMissingKon || 0) > 0) {
        varna('kon-okand', 'varning', `${_fkRader(ps.excludedMissingKon)} har ett kön som verktyget inte känner igen och faller bort.`);
    }
    if ((ps.excludedNoBas || 0) > 0) {
        varna('bortfall-bas', 'varning', `${_fkRader(ps.excludedNoBas)} saknar BAS-intervall och faller bort.`);
    }
    if ((ps.excludedZeroLon || 0) > 0) {
        const ogiltig = ps.invalidLon || 0;
        varna('bortfall-lon', 'varning', `${_fkRader(ps.excludedZeroLon)} saknar lön och faller bort${ogiltig ? `, varav ${ogiltig} med en lön som inte går att läsa som tal` : ''}.`);
    }

    const anvandaRubriker = new Set();
    const anvanda = [];
    for (const r of ROLLER) {
        const rubrik = mappning && mappning[r];
        if (!rubrik) continue;
        anvanda.push({ roll: r, rubrik });
        anvandaRubriker.add(rubrik);
    }
    const kolumner = {
        anvanda,
        oanvanda: (headers || []).filter(h => h && !anvandaRubriker.has(h)),
        profil: profil ? { namn: profil.namn, kalla: profil.kalla } : null,
    };
    return { tolkning, sammandrag, fordelning, varningar, kolumner };
}

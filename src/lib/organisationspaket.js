// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — organisationspaket (ADR-28).
 *
 * En systemägare samlar organisationens namn och benämningar, grundinställningar,
 * lönepolitiska ställningstagande och jämförelsestatistik i en JSON-fil som handläggarna
 * läser in i ett steg. Modulen bygger paketet ur appens delar och tolkar ett paket
 * tillbaka till dem. Bara vitlistade fält följer med; allt annat ignoreras, så att en
 * manipulerad fil inte kan föra in något annat än aggregat i verktyget.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

export const PAKET_FORMAT = 'lonekartlaggning-organisationspaket';
export const PAKET_VERSION = 1;
export const PAKET_MAX_BYTE = 5 * 1024 * 1024;

const MAX_TEXT = 200;
const PNR = /\b(19|20)?\d{6}[-+]?\d{4}\b/;
const EPOST = /\S+@\S+\.\S+/;

/** Liknar texten ett personnummer eller en e-postadress? (Samma mönster som paketkontrollen.) */
export function liknarPersonuppgift(text) {
    const t = String(text ?? '');
    return PNR.test(t) || EPOST.test(t);
}

// Textfält saneras vid inläsning: HTML-metatecken (< > " ' &) tas bort, texten trimmas och kortas
// till 200 tecken. Fälten är benämningar och koder som aldrig legitimt innehåller tecknen; esc() vid
// rendering är det egentliga skyddet, detta är ett extra lager på samma sätt som för lönefilen.
const _text = v => {
    if (typeof v !== 'string') return undefined;
    const t = v.replace(/[<>"'&]/g, '').trim();
    return t ? t.substring(0, MAX_TEXT) : undefined;
};
const _tal = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined);
const _talEllerNull = v => (v == null ? null : (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : NaN));
const _utanTomma = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
// Minsta gruppstorlek för redovisning (ADR-38): heltal 2–1000, annars utelämnat.
const _kTroskel = v => (Number.isInteger(v) && v >= 2 && v <= 1000 ? v : undefined);
// Beräkningsperioden väljs bland verktygets värden (Prioriteringens rullista).
const PERIODER = [3, 6, 9, 12];
const _period = v => (PERIODER.includes(v) ? v : undefined);
// Låsningar som systemägaren kan sätta (ADR-47). Rensning vid inaktivitet: 0 (av) eller 5–120 minuter.
export const INAKTIVITET_MIN = 5;
export const INAKTIVITET_MAX = 120;
const _inaktivitet = v => (v === 0 || (Number.isInteger(v) && v >= INAKTIVITET_MIN && v <= INAKTIVITET_MAX) ? v : undefined);

// ---- Rader ----

function _referensRad(r) {
    if (!r || typeof r !== 'object') return null;
    const bas = _text(r.bas)?.toUpperCase() ?? null;
    const aid = _text(r.aid) ?? null;
    if (!bas && !aid) return null;
    const p10 = _talEllerNull(r.p10), med = _talEllerNull(r.med), p90 = _talEllerNull(r.p90);
    if ([p10, med, p90].some(Number.isNaN)) return null;
    return { aid, bas, p10, med, p90 };
}

function _statistikRad(r) {
    if (!r || typeof r !== 'object') return null;
    const aid = _text(r.aid);
    const median = _tal(r.median, Number.MIN_VALUE, Infinity);
    if (!aid || median === undefined) return null;
    const p10 = r.p10 == null ? 0 : _tal(r.p10, 0, Infinity);
    const p90 = r.p90 == null ? 0 : _tal(r.p90, 0, Infinity);
    const nKv = _talEllerNull(r.nKv), nMa = _talEllerNull(r.nMa);
    const andelKv = r.andelKv == null ? null : _tal(r.andelKv, 0, 100);
    if (p10 === undefined || p90 === undefined || Number.isNaN(nKv) || Number.isNaN(nMa) || andelKv === undefined) return null;
    return { aid, aidFull: _text(r.aidFull) ?? aid, bas: typeof r.bas === 'string' ? r.bas.trim().toUpperCase().substring(0, 10) : '',
             median, p10, p90, nKv, nMa, andelKv };
}

// Organisationstypen styr vilken del av SKR:s personalstatistik som är referens (ADR-34).
function _orgTyp(v) {
    return v === 'kommun' || v === 'region' ? v : undefined;
}

// ---- Bygga ----

/**
 * Bygger ett paket ur appens delar. Tomma delar utelämnas.
 * @param {{organisation:string, utgivare?:string, skapat:string, avserAr?:number,
 *          profil?:Object, installningar?:Object, referens?:Object|null, statistik?:Object|null}} u
 * @returns {Object} JSON-säkert paket
 */
export function byggPaket(u) {
    const p = u.profil || {}, inst = u.installningar || {};
    /** @type {{[k:string]:any}} */
    const paket = {
        format: PAKET_FORMAT,
        version: PAKET_VERSION,
        organisation: { namn: _text(u.organisation) },
        ..._utanTomma({ utgivare: _text(u.utgivare), skapat: _text(u.skapat), avserAr: _tal(u.avserAr, 2000, 2100) }),
        profil: _utanTomma({
            jamforelseNamn: _text(p.benchmarkLabel), jamforelseGenitiv: _text(p.benchmarkLabelGenitive),
            jamforelseKort: _text(p.benchmarkShort), basSystem: _text(p.basSystem), aidSystem: _text(p.aidSystem),
            organisationstyp: _orgTyp(p.orgTyp),
        }),
        installningar: _utanTomma({
            poPct: _tal(inst.poPct, 0, 100), poNot: _text(inst.poNot), manader: _period(inst.months), kTroskel: _kTroskel(inst.kTroskel),
            // Låsningarna (ADR-47): bara giltiga värden följer med; en låsning av rensningstiden kräver ett värde över 0.
            kTroskelLagst: _kTroskel(inst.kTroskelLagst),
            inaktivitetMin: _inaktivitet(inst.inaktivitetMin),
            inaktivitetLast: inst.inaktivitetLast === true && _inaktivitet(inst.inaktivitetMin) > 0 ? true : undefined,
            smaGrupperIExport: inst.smaGrupperIExport === false ? false : undefined,
        }),
    };
    const refRader = (u.referens?.rader || []).map(_referensRad).filter(Boolean);
    if (refRader.length) paket.referens = { ..._utanTomma({ namn: _text(u.referens.namn), kortnamn: _text(u.referens.kortnamn) }), rader: refRader };
    const statRader = (u.statistik?.rader || []).map(_statistikRad).filter(Boolean);
    if (statRader.length) paket.statistik = { ..._utanTomma({ namn: _text(u.statistik.namn) }), rader: statRader };
    return paket;
}

// ---- Tolka ----

// Alla textvärden i paketet, för kontrollen av personuppgifter.
function _allaTexter(v, ut = []) {
    if (typeof v === 'string') ut.push(v);
    else if (Array.isArray(v)) v.forEach(x => _allaTexter(x, ut));
    else if (v && typeof v === 'object') Object.keys(v).forEach(k => _allaTexter(v[k], ut));
    return ut;
}

/**
 * Låsningarna i installningar (ADR-47), normaliserade. Ett ogiltigt värde utelämnas med en varning, så att ett
 * paket aldrig tyst låser något annat än det systemägaren skrev. Rensningstiden kan inte låsas i läget Av (0).
 */
function _lasningar(inst, varningar) {
    const ut = {};
    if (inst.kTroskelLagst != null) {
        const n = _kTroskel(inst.kTroskelLagst);
        if (n === undefined) varningar.push('Paketets lägsta tillåtna minsta gruppstorlek är ogiltig och används inte.');
        else ut.kTroskelLagst = n;
    }
    if (inst.inaktivitetMin != null) {
        const n = _inaktivitet(inst.inaktivitetMin);
        if (n === undefined) varningar.push(`Paketets tid för rensning vid inaktivitet är ogiltig (0 eller ${INAKTIVITET_MIN}–${INAKTIVITET_MAX} minuter) och används inte.`);
        else ut.inaktivitetMin = n;
    }
    if (inst.inaktivitetLast != null) {
        if (typeof inst.inaktivitetLast !== 'boolean') varningar.push('Paketets låsning av rensning vid inaktivitet är ogiltig och används inte.');
        else if (inst.inaktivitetLast) {
            if (ut.inaktivitetMin === undefined) varningar.push('Paketet låser rensning vid inaktivitet utan ett giltigt värde; låsningen används inte.');
            else if (ut.inaktivitetMin === 0) varningar.push('Rensning vid inaktivitet kan inte låsas i läget Av; låsningen används inte.');
            else ut.inaktivitetLast = true;
        }
    }
    if (inst.smaGrupperIExport != null) {
        if (typeof inst.smaGrupperIExport !== 'boolean') varningar.push('Paketets fält om små grupper i exporten är ogiltigt och används inte.');
        else ut.smaGrupperIExport = inst.smaGrupperIExport;
    }
    return ut;
}

function _rader(del, radFn, benamning, varningar) {
    if (!del || typeof del !== 'object' || !Array.isArray(del.rader)) return null;
    const rader = del.rader.map(radFn).filter(Boolean);
    const bort = del.rader.length - rader.length;
    if (bort) varningar.push(`${bort} ${bort === 1 ? 'rad' : 'rader'} i ${benamning} hoppades över (saknade eller ogiltiga värden).`);
    return rader.length ? rader : null;
}

/**
 * Tolkar ett paket (filens text) till appens delar.
 * @param {string} text
 * @returns {{ok:true, paket:Object, delar:Object, varningar:string[]} | {ok:false, fel:string}}
 */
export function tolkaPaket(text) {
    if (typeof text !== 'string') return { ok: false, fel: 'Filen kunde inte läsas.' };
    if (text.length > PAKET_MAX_BYTE) return { ok: false, fel: 'Filen är för stor för att vara ett organisationspaket (högst 5 MB).' };
    let o;
    try { o = JSON.parse(text); } catch (_e) { return { ok: false, fel: 'Filen är inte giltig JSON.' }; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, fel: 'Filen är inte ett organisationspaket.' };

    if (o.format !== PAKET_FORMAT) return { ok: false, fel: 'Filen är inte ett organisationspaket för lönekartläggning.' };
    if (typeof o.version !== 'number' || o.version > PAKET_VERSION) {
        return { ok: false, fel: `Paketet har version ${o.version}; verktyget läser version ${PAKET_VERSION}. Uppdatera verktyget.` };
    }
    const organisation = _text(o.organisation?.namn);
    if (!organisation) return { ok: false, fel: 'Paketet saknar organisationens namn (organisation.namn).' };
    const skapat = _text(o.skapat);
    if (!skapat || !/^\d{4}-\d{2}-\d{2}$/.test(skapat)) return { ok: false, fel: 'Paketet saknar datum (skapat, ÅÅÅÅ-MM-DD).' };
    if (_allaTexter(o).some(t => PNR.test(t) || EPOST.test(t))) {
        return { ok: false, fel: 'Paketet innehåller något som liknar personnummer eller e-post och läses inte in.' };
    }

    const varningar = [];
    const refRader = _rader(o.referens, _referensRad, 'ställningstagandet', varningar);
    const statRader = _rader(o.statistik, _statistikRad, 'jämförelsestatistiken', varningar);
    if (!refRader && !statRader) return { ok: false, fel: 'Paketet innehåller varken ett lönepolitiskt ställningstagande eller jämförelsestatistik.' };
    if (!refRader) varningar.push('Paketet innehåller inget lönepolitiskt ställningstagande.');
    if (!statRader) varningar.push('Paketet innehåller ingen jämförelsestatistik.');

    const p = o.profil && typeof o.profil === 'object' ? o.profil : {};
    const inst = o.installningar && typeof o.installningar === 'object' ? o.installningar : {};
    if (inst.kTroskel != null && _kTroskel(inst.kTroskel) === undefined) varningar.push('Paketets minsta gruppstorlek är ogiltig och används inte.');
    const las = _lasningar(inst, varningar);
    // Paketets egen tröskel får inte ligga under paketets golv: den höjs till golvet, med en varning.
    let kTroskel = _kTroskel(inst.kTroskel);
    if (kTroskel !== undefined && las.kTroskelLagst !== undefined && kTroskel < las.kTroskelLagst) {
        varningar.push(`Paketets minsta gruppstorlek ${kTroskel} är lägre än dess lägsta tillåtna ${las.kTroskelLagst} och höjs till ${las.kTroskelLagst}.`);
        kTroskel = las.kTroskelLagst;
    }
    return {
        ok: true,
        paket: _utanTomma({ organisation, utgivare: _text(o.utgivare), skapat, avserAr: _tal(o.avserAr, 2000, 2100) }),
        delar: {
            profil: _utanTomma({ name: organisation, benchmarkLabel: _text(p.jamforelseNamn),
                benchmarkLabelGenitive: _text(p.jamforelseGenitiv), benchmarkShort: _text(p.jamforelseKort),
                basSystem: _text(p.basSystem), aidSystem: _text(p.aidSystem), orgTyp: _orgTyp(p.organisationstyp) }),
            installningar: _utanTomma({ poPct: _tal(inst.poPct, 0, 100), poNot: _text(inst.poNot), months: _period(inst.manader), kTroskel, ...las }),
            referens: refRader ? { ..._utanTomma({ namn: _text(o.referens.namn), kortnamn: _text(o.referens.kortnamn) }), rader: refRader } : null,
            statistik: statRader ? { ..._utanTomma({ namn: _text(o.statistik.namn) }), rader: statRader } : null,
        },
        varningar,
    };
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Figurformatet (ADR-39; se docs/utveckling/diagramkarnan.md)
 *
 * En figur är ren data som beskriver ett diagram: axlar, lager av märken och referenser.
 * Vyerna bygger figurer; ritaren (src/app/10-diagramlayout.js, 10-diagrammarken.js, 10-diagramritare.js) gör SVG av dem. Här ligger
 * allt som går att avgöra utan DOM och utan D3: validering, små grupper, domäner,
 * lådstatistik och talformat. Modulen vet ingenting om state, flikar eller k-tröskelns värde.
 *
 * Läge anges alltid i skärmens axlar: x är vågrät, y lodrät. En liggande stapel har alltså
 * kategorin i y och värdet i x. Kategorier på en bandskala jämförs som strängar.
 *
 * Formatet som det är byggt — alla val, vad vyn själv måste göra för att små grupper ska vara skyddade, och
 * kända luckor — står i docs/utveckling/diagramkarnan.md.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { quantile } from './stat.js';

export const MARKEN = ['stapel', 'intervall', 'punkt', 'linje', 'band', 'lada', 'ruta', 'yta'];
const SKALOR = ['band', 'linjar', 'log'];

const _nf = new Map();
function _tal(dec) {
    if (!_nf.has(dec)) _nf.set(dec, new Intl.NumberFormat('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
    return _nf.get(dec);
}

/**
 * Tal som text med svensk lokal. Namngivna format i stället för formatsträngar i vyerna.
 * @param {number|null|undefined} v  annat än ett ändligt tal ger '–'
 * @param {'kr'|'pct'|'pctAbs'|'antal'|'tal2'|'ar'|undefined} namn  pctAbs: procent utan tecken (axeln i en
 *   divergerande stapel, där vänster och höger båda är andelar)
 * @param {{enhet?: boolean}} [val] enhet: false utelämnar " kr" och " %" (axelmarkeringar)
 */
export function talformat(v, namn, val) {
    const enhet = !val || val.enhet !== false;
    if (typeof v !== 'number' || !isFinite(v)) return '–';
    // Avrunda först och normalisera sedan: ett värde som blir noll i formatet får inget minustecken.
    const rund = (x, dec) => { const f = 10 ** dec, r = Math.round(x * f) / f; return r === 0 ? 0 : r; };
    if (namn === 'kr') return _tal(0).format(rund(v, 0)) + (enhet ? ' kr' : '');
    if (namn === 'pct') return _tal(1).format(rund(v, 1)) + (enhet ? ' %' : '');
    if (namn === 'pctAbs') { const a = Math.abs(rund(v, 1)); return _tal(Number.isInteger(a) ? 0 : 1).format(a) + (enhet ? ' %' : ''); }
    if (namn === 'tal2') return _tal(2).format(rund(v, 2));
    if (namn === 'antal' || namn === 'ar') return _tal(0).format(rund(v, 0));
    return _tal(Number.isInteger(v) ? 0 : 1).format(rund(v, Number.isInteger(v) ? 0 : 1));
}

/**
 * Kvantilpunkterna i ett kvantilpunktdiagram (lada med form: 'kvantiler'): `antal` lika
 * stora andelar av gruppen, var och en företrädd av kvantilen i sin mitt, (i + 0,5) / antal, med samma
 * interpolation som stat.quantile. Antalet är högst `antalMax` och högst halva gruppen, så att en prick aldrig
 * står för färre än två personer. null när gruppen har färre än två värden.
 * @param {number[]} varden
 * @param {number} [antalMax]
 * @returns {{antal: number, varden: number[]}|null}
 */
export function kvantilpunkter(varden, antalMax = 20) {
    const v = (varden || []).filter(x => typeof x === 'number' && isFinite(x)).sort((a, b) => a - b);
    const antal = Math.min(antalMax, Math.floor(v.length / 2));
    if (antal < 1) return null;
    const q = p => { const pos = (v.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos); return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (pos - lo); };
    return { antal, varden: Array.from({ length: antal }, (_, i) => q((i + 0.5) / antal)) };
}

/**
 * Skillnaden mellan kvinnors och mäns medianlön i kronor per månad, avrundad till närmaste hundratal: negativ när
 * kvinnorna ligger lägre (verktygets tecken). Ett lönegap förstås bättre i pengar än bara i procent.
 * null när någon median saknas. Anroparen skickar bara medianer som får redovisas (båda könen når tröskeln).
 * @param {number|null|undefined} medKv
 * @param {number|null|undefined} medMa
 * @returns {number|null}
 */
export function kronorSkillnad(medKv, medMa) {
    if (typeof medKv !== 'number' || typeof medMa !== 'number' || !isFinite(medKv) || !isFinite(medMa) || !(medMa > 0) || !(medKv > 0)) return null;
    const r = Math.round((medKv - medMa) / 100) * 100;
    return r === 0 ? 0 : r;
}

/** Verktygstipsets rad för skillnaden i kronor, eller ingen rad när beloppet saknas. */
export function kronorTipsRad(skillnadKr) {
    if (typeof skillnadKr !== 'number' || !isFinite(skillnadKr)) return [];
    const t = talformat(Math.abs(skillnadKr), 'kr', { enhet: false });
    return [['Skillnad', `${skillnadKr < 0 ? '−' : skillnadKr > 0 ? '+' : ''}${t} kr/mån`]];
}

// Vilka fält i en datapunkt som ligger på skärmaxeln a ('x' | 'y') för lagret l.
function _falt(l, a) {
    const liggande = l.riktning === 'liggande';
    if (l.marke === 'band') return a === 'x' ? ['x'] : ['lag', 'hog'];
    if (l.marke === 'yta') return a === 'x' ? ['x0', 'x1'] : ['y0', 'y1'];   // fria ytor (trädkarta): två hörn på talaxlar
    if (l.marke === 'intervall') return (a === 'x') === liggande ? ['lag', 'hog'] : [a];
    return [a];
}
// Skärmaxeln ett lager lägger sina VÄRDEN längs (den andra bär kategorin eller x-värdet).
function _vardeaxel(l) { return l.riktning === 'liggande' ? 'x' : 'y'; }
// Vilken skärmaxel figurens axel a ('x' | 'y' | 'y2') motsvarar för lagret, eller null.
function _skarmaxel(l, a) {
    if (a === 'x') return 'x';
    return (l.axel || 'y') === a ? 'y' : null;
}

/** Alla värden som lagren lägger på en axel ('x' | 'y' | 'y2'), i dataordning. */
export function axelVarden(figur, axel) {
    const ut = [];
    for (const l of figur.lager) {
        const a = _skarmaxel(l, axel);
        if (!a) continue;
        const falt = _falt(l, a);
        const medFel = (l.marke === 'stapel' || l.marke === 'punkt') && _vardeaxel(l) === a;
        for (const d of l.data) {
            for (const f of falt) if (d[f] != null) ut.push(d[f]);
            if (medFel && d.fel) ut.push(d.fel.lag, d.fel.hog);
        }
    }
    return ut;
}

// Staplade staplar staplar positiva värden uppåt och negativa nedåt, var för sig, per kategori och panel.
// Ger { min, max } (största positiva summan, mest negativa summan; null om ingen) eller null.
function _staplatSpann(figur, axel) {
    const plus = new Map(), minus = new Map();
    for (const l of figur.lager) {
        if (l.marke !== 'stapel' || l.lage !== 'staplad') continue;
        const a = _skarmaxel(l, axel);
        if (!a || _vardeaxel(l) !== a) continue;
        const kat = a === 'x' ? 'y' : 'x';
        const panel = l.panel == null ? '' : String(l.panel);
        for (const d of l.data) {
            if (!d) continue;
            const v = d[a];
            if (typeof v !== 'number' || !isFinite(v) || v === 0) continue;
            const m = v > 0 ? plus : minus;
            const k = panel + '\u0000' + String(d[kat]);
            m.set(k, (m.get(k) || 0) + v);
        }
    }
    let min = null, max = null;
    for (const v of plus.values()) if (max == null || v > max) max = v;
    for (const v of minus.values()) if (min == null || v < min) min = v;
    return min == null && max == null ? null : { min, max };
}

/**
 * Domänen för en axel. Bandskala: kategorierna som FINNS i lagrens data (som strängar), med
 * axelns `ordning` först — en etikett utan datapunkt ritas aldrig, så små grupper som tagits
 * bort lämnar inget spår på axeln (ADR-14). Talskala: [min, max]; staplar tar med noll.
 */
export function skalDoman(figur, axel) {
    const a = figur[axel];
    const varden = axelVarden(figur, axel);
    if (a.skala === 'band') {
        const finns = [];
        const sedda = new Set();
        for (const v of varden) { const k = String(v); if (!sedda.has(k)) { sedda.add(k); finns.push(k); } }
        const forst = (a.ordning || []).map(String).filter(k => sedda.has(k));
        const forstSet = new Set(forst);
        return [...forst, ...finns.filter(k => !forstSet.has(k))];
    }
    if (Array.isArray(a.doman) && a.doman.length === 2) return [a.doman[0], a.doman[1]];
    /** @type {number|null} */ let min = null;
    /** @type {number|null} */ let max = null;
    for (const v of varden) {
        if (typeof v !== 'number' || !isFinite(v)) continue;
        if (min == null || v < min) min = v;
        if (max == null || v > max) max = v;
    }
    if (min == null || max == null) return a.skala === 'log' ? [1, 10] : [0, 1];
    const spann = _staplatSpann(figur, axel);
    if (spann) {
        if (spann.max != null && spann.max > max) max = spann.max;
        if (spann.min != null && spann.min < min) min = spann.min;
    }
    if (a.skala !== 'log') {
        const harStapel = figur.lager.some(l => l.marke === 'stapel' && _skarmaxel(l, axel) === _vardeaxel(l));
        if (harStapel) { if (min > 0) min = 0; if (max < 0) max = 0; }
    }
    if (min === max) { min -= 1; max += 1; }
    return [min, max];
}

/**
 * De paneler som har minst ett av lagren, i panelernas ordning. Ett lager utan `panel` hör till varje
 * panel. Regeln finns bara här: utanSmaGrupper och ritaren (_rfSynligt) använder den båda, så figuren
 * och bilden namnger aldrig olika paneler.
 */
export function panelerMedLager(paneler, lager) {
    return paneler.filter(p => lager.some(l => l.panel == null || l.panel === p));
}

/**
 * Figuren utan datapunkter märkta `liten`, utan lager som blev tomma och utan null-poster i data.
 * Originalet rörs inte. Bandaxlarna får originalets kategoriordning som `ordning`, begränsad till
 * kategorier som finns kvar, och `paneler` bara de paneler som har något lager kvar — figuren bär
 * alltså inga namn på borttagna grupper.
 */
export function utanSmaGrupper(figur) {
    const rent = l => ({ ...l, data: l.data.filter(d => d && typeof d === 'object') });
    const lager = figur.lager.map(l => ({ ...rent(l), data: rent(l).data.filter(d => !d.liten) })).filter(l => l.data.length);
    const ut = { ...figur, lager };
    if (Array.isArray(figur.paneler)) ut.paneler = panelerMedLager(figur.paneler, lager);
    const original = { ...figur, lager: figur.lager.map(rent) };
    for (const a of ['x', 'y']) {
        if (!figur[a] || figur[a].skala !== 'band') continue;
        // Originalets ordning (uttrycklig `ordning` först, sedan första förekomst), därefter bara det som finns kvar.
        const full = skalDoman(original, a);
        ut[a] = { ...figur[a], ordning: skalDoman({ ...ut, [a]: { ...figur[a], ordning: full } }, a) };
    }
    return ut;
}

/** Antal datapunkter i figuren. */
export function antalPunkter(figur) {
    let n = 0;
    for (const l of figur.lager) n += l.data.length;
    return n;
}

/**
 * Lådans mått: kvartiler med samma metod som verktygets tabeller (stat.js quantile), morrhår
 * till yttersta värdet inom 1,5 kvartilavstånd, övriga som avvikare.
 * @returns {{q1:number, median:number, q3:number, lag:number, hog:number, avvikare:number[]} | null}
 */
export function ladstatistik(varden) {
    const v = (varden || []).filter(x => typeof x === 'number' && isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const q1 = quantile(v, 0.25), median = quantile(v, 0.5), q3 = quantile(v, 0.75);
    const kant = 1.5 * (q3 - q1);
    const inom = v.filter(x => x >= q1 - kant && x <= q3 + kant);
    return { q1, median, q3, lag: inom[0], hog: inom[inom.length - 1], avvikare: v.filter(x => x < q1 - kant || x > q3 + kant) };
}

// ---- Urval: dimensioner användaren kan filtrera diagrammet på (figur.urval) ----
// `figur.urval` är en lista med dimensioner, eller ett ensamt objekt (då en lista med ett element). En dimension är
//   { typ: 'kategori', falt, namn, etikett?, visning? } — en knapp per värde, eller en hopfälld lista med
//       kryssrutor (visning: 'lista', eller fler än URVAL_LISTA_MAX värden); utan typ är det en kategori (det äldre formatet)
//   { typ: 'intervall', falt, namn, format?, etikett? } — fälten Minst och Högst
// Ett filter döljer bara märken; inget tal räknas om — utom i ett härlett lager (harleddAv, se harleddaLager).

/** Talformaten som `talformat` känner (och som en intervalldimensions `format` får vara). */
export const TALFORMAT = Object.freeze(['kr', 'pct', 'pctAbs', 'antal', 'tal2', 'ar']);
const URVAL_TYPER = ['kategori', 'intervall'];
/** En kategori med fler värden än så visas som en lista med kryssrutor i stället för en knapp per värde. */
export const URVAL_LISTA_MAX = 12;

/**
 * Sant när kategoridimensionen `dim` med `antal` värden visas som en lista (kryssrutor, sökfält, Markera alla):
 * dimensionen har `visning: 'lista'`, eller fler än URVAL_LISTA_MAX värden.
 * @param {any} dim @param {number} antal
 */
export function urvalSomLista(dim, antal) {
    return !!dim && (dim.visning === 'lista' || antal > URVAL_LISTA_MAX);
}

// Dimensionens typ: utan `typ` är den en kategori (det äldre formatet { falt, namn, etikett }).
function _urvalTyp(u) { return u && u.typ != null ? u.typ : 'kategori'; }
// Figurens urval som en lista, utan att skapa nya objekt (används per datapunkt av arBortvald).
function _urvalRa(figur) {
    const u = figur && figur.urval;
    if (u == null) return [];
    return Array.isArray(u) ? u : [u];
}

/**
 * Figurens urval som en lista med dimensioner, där varje dimension har sin `typ` utskriven. Ett ensamt objekt blir
 * en lista med ett element; ett objekt utan typ är en kategori. Utan urval: en tom lista.
 * @param {any} figur
 * @returns {Array<{typ: 'kategori'|'intervall', falt: string, namn: string, etikett?: string, format?: string}>}
 */
export function urvalLista(figur) {
    return _urvalRa(figur).filter(u => u && typeof u === 'object').map(u => (u.typ != null ? u : { ...u, typ: 'kategori' }));
}

// Dimensionen `dim` (en dimension eller ett fältnamn) i figurens urval, eller den första av typen `typ` när dim saknas.
function _urvalDim(figur, dim, typ) {
    const lista = urvalLista(figur);
    if (dim == null) return lista.find(u => u.typ === typ) || null;
    const falt = typeof dim === 'string' ? dim : dim && dim.falt;
    const u = lista.find(x => x.falt === falt);
    return u && u.typ === typ ? u : null;
}

// Fältets värde i en datapunkt som sträng, eller null när punkten saknar fältet.
function _faltSomText(d, falt) {
    if (!d || typeof d !== 'object') return null;
    const v = d[falt];
    return v == null ? null : String(v);
}

/**
 * Knappens text för värdet v i en kategoridimension: mallen `etikett` med `{v}` utbytt (t.ex. 'BAS {v}' → 'BAS A'),
 * eller värdet självt utan mall. `dim` är dimensionen eller dess fält; utan dim: figurens första kategoridimension.
 * @param {any} figur @param {any} dim @param {string} v
 */
export function urvalEtikett(figur, dim, v) {
    const u = _urvalDim(figur, dim, 'kategori');
    const mall = u ? u.etikett : null;
    return typeof mall === 'string' ? mall.split('{v}').join(String(v)) : String(v);
}

/**
 * De olika värdena i en kategoridimension bland alla lagers punkter som har fältet, som strängar.
 * En liten punkt räknas inte, om inte `visaSma` — en kategori som bara finns i små grupper blir aldrig en knapp.
 * Ordning: som figurens bandaxel (x, sedan y) när värdet med etiketten insatt är en kategori där; övriga värden
 * efter, i svensk sorteringsordning. Utan en sådan dimension: en tom lista.
 * @param {any} figur
 * @param {any} [dim]  dimensionen eller dess fält; utan dim: figurens första kategoridimension
 * @param {{visaSma?: boolean}} [val]
 * @returns {string[]}
 */
export function urvalVarden(figur, dim, { visaSma = false } = {}) {
    const u = _urvalDim(figur, dim, 'kategori');
    if (!u) return [];
    const varden = new Set();
    for (const l of figur.lager || []) {
        for (const d of (l && Array.isArray(l.data) ? l.data : [])) {
            if (!visaSma && d && d.liten) continue;
            const v = _faltSomText(d, u.falt);
            if (v != null) varden.add(v);
        }
    }
    // Bandaxelns ordning räknas ur hela figuren (utan null-poster); den bestämmer bara rangen, inte vilka värden som finns.
    const rent = { ...figur, lager: (figur.lager || []).map(l => ({ ...l, data: (l.data || []).filter(d => d && typeof d === 'object') })) };
    const rang = new Map();
    for (const a of ['x', 'y']) {
        if (!figur[a] || figur[a].skala !== 'band') continue;
        for (const k of skalDoman(rent, a)) if (!rang.has(k)) rang.set(k, rang.size);
    }
    const et = v => urvalEtikett(figur, u, v);
    const ordnade = [], ovriga = [];
    for (const v of varden) (rang.has(et(v)) ? ordnade : ovriga).push(v);
    ordnade.sort((a, b) => rang.get(et(a)) - rang.get(et(b)));
    ovriga.sort((a, b) => a.localeCompare(b, 'sv'));
    return [...ordnade, ...ovriga];
}

/**
 * Det minsta och största talet i en intervalldimension bland alla lagers punkter som har fältet som ett ändligt tal.
 * En liten punkt räknas inte, om inte `visaSma`. null när det finns färre än två olika tal (då finns inget att välja).
 * @param {any} figur
 * @param {any} dim  dimensionen eller dess fält; utan dim: figurens första intervalldimension
 * @param {{visaSma?: boolean}} [val]
 * @returns {{min: number, max: number}|null}
 */
export function urvalSpann(figur, dim, { visaSma = false } = {}) {
    const u = _urvalDim(figur, dim, 'intervall');
    if (!u) return null;
    let min = Infinity, max = -Infinity;
    for (const l of figur.lager || []) {
        for (const d of (l && Array.isArray(l.data) ? l.data : [])) {
            if (!d || typeof d !== 'object' || (!visaSma && d.liten)) continue;
            const v = d[u.falt];
            if (typeof v !== 'number' || !isFinite(v)) continue;
            if (v < min) min = v;
            if (v > max) max = v;
        }
    }
    return min < max ? { min, max } : null;
}

// Filtret som { kategori: Map, intervall: Map }. En mängd (det äldre formatet) är de bortvalda värdena i figurens
// första kategoridimension. Annat än ett objekt: inget filter.
function _filterNorm(figur, filter) {
    if (!filter || typeof filter !== 'object') return null;
    if (typeof filter.has === 'function') {
        const k = _urvalRa(figur).find(u => u && _urvalTyp(u) === 'kategori');
        return k ? { kategori: new Map([[k.falt, filter]]), intervall: null } : null;
    }
    const map = m => (m && typeof m.get === 'function' ? m : null);
    return { kategori: map(filter.kategori), intervall: map(filter.intervall) };
}

/**
 * Sant när punkten d döljs av filtret: den har fältet för en av figurens dimensioner och värdet är bortvalt
 * (kategori) eller ligger utanför intervallet (gränserna ingår, en gräns som saknas gäller inte). En punkt utan
 * fältet (t.ex. en referens) påverkas aldrig, och ett filter på ett fält som inte är en dimension i figuren gäller inte.
 * @param {any} figur
 * @param {{kategori?: Map<string, Set<string>>, intervall?: Map<string, {min?: number|null, max?: number|null}>}|Set<string>|null|undefined} filter
 *   en mängd (det äldre formatet) är de bortvalda värdena i figurens första kategoridimension
 * @param {any} d
 */
export function arBortvald(figur, filter, d) {
    if (!d || typeof d !== 'object' || !filter || typeof filter !== 'object') return false;
    // Anropas per datapunkt och ritning: inga nya objekt här.
    const f = /** @type {any} */ (filter);
    const mangd = typeof f.has === 'function';
    const kat = mangd ? null : (f.kategori && typeof f.kategori.get === 'function' ? f.kategori : null);
    const int = mangd ? null : (f.intervall && typeof f.intervall.get === 'function' ? f.intervall : null);
    let forstaKategori = true;
    for (const u of _urvalRa(figur)) {
        if (!u || typeof u !== 'object') continue;
        const intervall = _urvalTyp(u) === 'intervall';
        const b = !intervall && mangd && forstaKategori ? f : null;
        if (!intervall) forstaKategori = false;
        const v = d[u.falt];
        if (v == null) continue;
        if (intervall) {
            const g = int && int.get(u.falt);
            if (!g || typeof v !== 'number' || !isFinite(v)) continue;
            if (typeof g.min === 'number' && v < g.min) return true;
            if (typeof g.max === 'number' && v > g.max) return true;
        } else {
            const m = b || (kat && kat.get(u.falt));
            if (m && typeof m.has === 'function' && m.has(String(v))) return true;
        }
    }
    return false;
}

// Ett tal i en gräns: dimensionens format, men ett antal med decimaler visas med en decimal.
function _gransText(v, format, enhet) {
    const f = format === 'antal' && !Number.isInteger(v) ? undefined : format;
    return talformat(v, f, { enhet });
}

/**
 * Intervallets text, t.ex. '10–50', 'minst 10', 'högst 50' (med dimensionens format), eller '' utan gränser.
 * @param {{format?: string}} dim @param {{min?: number|null, max?: number|null}|null|undefined} g
 */
export function urvalIntervallText(dim, g) {
    const fmt = dim && dim.format;
    const min = g && typeof g.min === 'number' && isFinite(g.min) ? g.min : null;
    const max = g && typeof g.max === 'number' && isFinite(g.max) ? g.max : null;
    if (min != null && max != null) return `${_gransText(min, fmt, false)}–${_gransText(max, fmt, true)}`;
    if (min != null) return `minst ${_gransText(min, fmt, true)}`;
    if (max != null) return `högst ${_gransText(max, fmt, true)}`;
    return '';
}

/**
 * Det aktiva filtret som text, en del per dimension i figurens ordning: för en kategori 'utan BAS A, BAS N'
 * (etiketterna i värdenas ordning), för ett intervall mallen `etikett` med `{v}` utbytt mot intervallet
 * ('{v} personer i gruppen' → '10–50 personer i gruppen'), eller namnet och intervallet utan mall. Noten under
 * diagrammet och exportens fotrad visar samma text. Utan något aktivt: en tom lista.
 * En kategori som visas som lista (urvalSomLista) med fler än tre bortvalda säger i stället 'bara X, Y' (högst tre
 * valda) eller namnet och antalet ('Yrkesgrupp 12 av 40'); antalet räknas bland värdena som får visas (`visaSma`).
 * @param {any} figur @param {any} filter (se arBortvald) @param {{visaSma?: boolean}} [val]
 * @returns {string[]}
 */
export function urvalBeskrivning(figur, filter, { visaSma = false } = {}) {
    const f = _filterNorm(figur, filter);
    if (!f) return [];
    const ut = [];
    for (const u of urvalLista(figur)) {
        if (u.typ === 'intervall') {
            const t = urvalIntervallText(u, f.intervall && f.intervall.get(u.falt));
            if (t) ut.push(typeof u.etikett === 'string' ? u.etikett.split('{v}').join(t) : `${u.namn} ${t}`);
        } else {
            const b = f.kategori && f.kategori.get(u.falt);
            if (!b || typeof b.has !== 'function' || !b.size) continue;
            const etiketter = urvalVarden(figur, u, { visaSma: true }).filter(v => b.has(v)).map(v => urvalEtikett(figur, u, v));
            if (!etiketter.length) continue;
            const varden = urvalVarden(figur, u, { visaSma });
            if (etiketter.length > 3 && urvalSomLista(u, varden.length)) {
                const valda = varden.filter(v => !b.has(v));
                ut.push(valda.length && valda.length <= 3 ? `bara ${valda.map(v => urvalEtikett(figur, u, v)).join(', ')}` : `${u.namn} ${valda.length} av ${varden.length}`);
            } else ut.push(`utan ${etiketter.join(', ')}`);
        }
    }
    return ut;
}

/**
 * Sant när filtret döljer något: ett bortvalt värde i en kategori eller en gräns i ett intervall (en mängd, det
 * äldre formatet: minst ett bortvalt värde). Annat än ett filter: falskt.
 * @param {any} filter
 */
export function urvalAktivt(filter) {
    if (!filter || typeof filter !== 'object') return false;
    if (typeof filter.has === 'function') return filter.size > 0;
    const kat = filter.kategori && typeof filter.kategori.values === 'function' ? [...filter.kategori.values()] : [];
    if (kat.some(s => s && s.size > 0)) return true;
    const int = filter.intervall && typeof filter.intervall.values === 'function' ? [...filter.intervall.values()] : [];
    return int.some(g => g && ((typeof g.min === 'number' && isFinite(g.min)) || (typeof g.max === 'number' && isFinite(g.max))));
}

/**
 * Figuren med sina härledda lager räknade för filtret. Ett lager med `harleddAv: { lager, berakna, minN?, namn?,
 * villkor? }` (t.ex. en trendlinje) räknas ur punkterna i källagren — lagren vars `serie` står i `lager`. Utan ett
 * aktivt filter (urvalAktivt) är svaret figuren själv, samma objekt: talen är då vyns egna. Med ett aktivt filter får
 * lagret `berakna(punkter)` som data, där punkterna är källagrens SYNLIGA punkter (inte bortvalda, och inte små
 * om inte `visaSma`) — omräkningen bygger bara på det som redan syns — och, med `villkor`, bara de för vilka
 * `villkor(punkt)` är sant (t.ex. ett köns punkter ur lager per BAS-intervall). Källorna läses alltid ur källagrens
 * egna data, aldrig ur ett omräknat lager: ett lager får nämna sin egen serie (det läggs då om ur sina egna synliga
 * punkter, t.ex. trädkartans ytor) och ett sådant lager får vara källa till andra. Har källorna färre än `minN`
 * (minst 1) punkter blir lagret tomt (ritas inte) och står i `utelamnade`. `berakna` ger en lista, eller
 * `{ data, serie? }` när lagrets namn i förklaringen bär ett tal som också räknas om (R² i en trendlinje). Lagrets
 * index och övriga fält är oförändrade. Den nya figuren prövas med valideraFigur (kastar om `berakna` gav ogiltig data).
 * @param {any} figur  en giltig figur
 * @param {any} filter  se arBortvald
 * @param {{visaSma?: boolean}} [val]
 * @returns {{figur: any, omraknade: Array<{index: number, namn: string}>, utelamnade: Array<{index: number, namn: string, minN: number, antal: number}>}}
 */
export function harleddaLager(figur, filter, { visaSma = false } = {}) {
    /** @type {{figur: any, omraknade: Array<{index: number, namn: string}>, utelamnade: Array<{index: number, namn: string, minN: number, antal: number}>}} */
    const ut = { figur, omraknade: [], utelamnade: [] };
    const lager = figur && Array.isArray(figur.lager) ? figur.lager : [];
    if (!lager.some(l => l && l.harleddAv) || !urvalAktivt(filter)) return ut;
    const synlig = d => !!d && typeof d === 'object' && (visaSma || !d.liten) && !arBortvald(figur, filter, d);
    const nya = lager.map((l, index) => {
        const h = l && l.harleddAv;
        if (!h) return l;
        const kallor = new Set(h.lager.map(String));
        const villkor = typeof h.villkor === 'function' ? h.villkor : () => true;
        const punkter = [];
        lager.forEach((k, ki) => {
            if (!k || k.serie == null || !kallor.has(String(k.serie)) || (ki !== index && !_kanVaraKalla(k))) return;
            for (const d of k.data) if (synlig(d) && villkor(d)) punkter.push(d);
        });
        const minN = Math.max(1, typeof h.minN === 'number' && isFinite(h.minN) ? h.minN : 1);
        const namn = harlettNamn(l);
        if (punkter.length < minN) {
            ut.utelamnade.push({ index, namn, minN, antal: punkter.length });
            return { ...l, data: [] };
        }
        const svar = h.berakna(punkter);
        const data = Array.isArray(svar) ? svar : svar && typeof svar === 'object' && Array.isArray(svar.data) ? svar.data : null;
        if (!data) throw new Error(`Ogiltig figur (härlett lager ${index}): berakna måste ge en lista`);
        ut.omraknade.push({ index, namn });
        const serie = !Array.isArray(svar) && typeof svar.serie === 'string' && svar.serie.trim() ? { serie: svar.serie } : {};
        return { ...l, ...serie, data };
    });
    ut.figur = { ...figur, lager: nya };
    valideraFigur(ut.figur, 'härlett lager');
    return ut;
}

// Ett lager som får vara källa till ett annat: ett vanligt lager, eller ett som bara läggs om ur sina egna punkter
// (harleddAv.lager är just dess egen serie). Källan läses ur lagrets egna data, så ingen kedja räknas.
function _kanVaraKalla(k) {
    const h = k && k.harleddAv;
    return !h || (Array.isArray(h.lager) && h.lager.length > 0 && h.lager.every(s => String(s) === String(k.serie)));
}

/** Det härledda lagrets namn i noterna: `harleddAv.namn`, annars 'Serien <serie>' eller 'Lagret'. @param {any} l */
export function harlettNamn(l) {
    const h = l && l.harleddAv;
    if (h && typeof h.namn === 'string' && h.namn.trim()) return h.namn.trim();
    return l && l.serie != null ? `Serien ${l.serie}` : 'Lagret';
}

/**
 * Noterna om härledda lager efter harleddaLager: '<namn> gäller urvalet.' för ett omräknat lager och
 * '<namn> visas inte: färre än <minN> synliga punkter.' för ett som inte ritas.
 * @param {{omraknade?: Array<{namn: string}>, utelamnade?: Array<{namn: string, minN: number}>}|null|undefined} h
 * @returns {{omraknade: string[], utelamnade: string[]}}
 */
export function harlettNot(h) {
    const stor = s => s.charAt(0).toUpperCase() + s.slice(1);
    // Två lager med samma namn (en trendlinje och dess konfidensband, trädkartans två lager) ger en mening.
    const unika = a => [...new Set(a)];
    return {
        omraknade: unika(((h && h.omraknade) || []).map(o => `${stor(o.namn)} gäller urvalet.`)),
        utelamnade: unika(((h && h.utelamnade) || []).map(o => `${stor(o.namn)} visas inte: färre än ${talformat(o.minN, 'antal')} synliga punkter.`)),
    };
}

// ---- Underlag: diagrammet räknat för en del av personerna (figur.underlag) ----
// `figur.underlag = { dimensioner, rader, rita, k, kon? }`. `rader` är personerna i hela det underlag vyn redan ritar,
// `dimensioner` kategorier att räkna för ({ falt, namn, varde?, etikett?, visning?, ordning? }; `varde(rad)` ger radens
// värde, annars `rad[falt]`), `rita(valda, { beskrivning })` vyns egen beräkning för de valda raderna (en figur, eller
// en text när den inte går att rita), `k` tröskeln och `kon(rad)` 'kv', 'ma' eller null (annars fältet `kon` som i
// resten av verktyget).
//
// Skyddsregeln mot differensröjande: ett val godtas bara när både urvalet och resten (underlaget utom urvalet) har noll
// eller minst k personer av vartdera könet. Två till: ett värde vars egen grupp inte klarar regeln går inte att välja
// (det ingår bara i hela underlaget), och underlaget räknas för en dimension i taget. Då är skillnaden mellan två val
// alltid en förening av valbara värden — själva skyddade — och "alla" minus ett val är resten, som regeln prövar.

// Radens kön som 'kv' eller 'ma' (samma regel som konOf i falt.js), eller null.
function _underlagKon(underlag, r) {
    if (underlag && typeof underlag.kon === 'function') { const k = underlag.kon(r); return k === 'kv' || k === 'ma' ? k : null; }
    const k = r && r.kon;
    if (typeof k === 'string' && k.includes('kvinna')) return 'kv';
    return k === 'man' || k === 'män' ? 'ma' : null;
}

/**
 * Antalet kvinnor och män bland raderna.
 * @param {any} underlag @param {any[]} rader @returns {{kv: number, ma: number}}
 */
export function underlagKonAntal(underlag, rader) {
    const ut = { kv: 0, ma: 0 };
    for (const r of rader || []) { const k = _underlagKon(underlag, r); if (k) ut[k]++; }
    return ut;
}

/** Sant när vartdera könet har noll eller minst k personer. @param {{kv: number, ma: number}} antal @param {number} k */
export function underlagSkyddat(antal, k) {
    return [antal.kv, antal.ma].every(n => n === 0 || n >= k);
}

/**
 * Radens värde i dimensionen som sträng (`dim.varde(rad)`, annars `rad[dim.falt]`), eller null när det saknas.
 * @param {any} dim @param {any} rad @returns {string|null}
 */
export function underlagVarde(dim, rad) {
    const v = dim && typeof dim.varde === 'function' ? dim.varde(rad) : rad && dim ? rad[dim.falt] : null;
    return v == null || v === '' ? null : String(v);
}

/**
 * Dimensionen `falt` i figurens underlag, eller null.
 * @param {any} underlag @param {string} falt
 */
export function underlagDimension(underlag, falt) {
    const dims = underlag && Array.isArray(underlag.dimensioner) ? underlag.dimensioner : [];
    return dims.find(u => u && u.falt === falt) || null;
}

/**
 * Värdena som går att välja i dimensionen: de vars grupp (raderna med värdet) klarar skyddsregeln, i dimensionens
 * `ordning` (en jämförelsefunktion) eller svensk sorteringsordning. `utelamnade` är antalet värden som inte går att
 * välja; de ingår bara i hela underlaget.
 * @param {any} underlag @param {any} dim
 * @returns {{varden: string[], utelamnade: number}}
 */
export function underlagVarden(underlag, dim) {
    const grupper = new Map();
    for (const r of (underlag && underlag.rader) || []) {
        const v = underlagVarde(dim, r);
        if (v == null) continue;
        if (!grupper.has(v)) grupper.set(v, { kv: 0, ma: 0 });
        const k = _underlagKon(underlag, r);
        if (k) grupper.get(v)[k]++;
    }
    const varden = [];
    let utelamnade = 0;
    for (const [v, antal] of grupper) {
        if (antal.kv + antal.ma > 0 && underlagSkyddat(antal, underlag.k)) varden.push(v); else utelamnade++;
    }
    varden.sort(typeof dim.ordning === 'function' ? dim.ordning : (a, b) => a.localeCompare(b, 'sv', { numeric: true }));
    return { varden, utelamnade };
}

/**
 * Valet som gäller i ett filter (Map<falt, Set<bortvalda värden>>): den första dimensionen med ett bortvalt värde
 * som går att välja, som { dim, varden, valda } (valda: de valbara värden som inte är bortvalda), eller null när
 * underlaget är helt.
 * @param {any} underlag @param {Map<string, Set<string>>|null|undefined} filter
 */
export function underlagValet(underlag, filter) {
    if (!filter || typeof filter.get !== 'function') return null;
    for (const dim of (underlag && underlag.dimensioner) || []) {
        const bort = filter.get(dim.falt);
        if (!bort || !bort.size) continue;
        const { varden } = underlagVarden(underlag, dim);
        if (!varden.some(v => bort.has(v))) continue;
        return { dim, varden, valda: varden.filter(v => !bort.has(v)) };
    }
    return null;
}

/**
 * Prövar ett val mot skyddsregeln. `valda` är raderna i urvalet (de med ett valt värde i den valda dimensionen; hela
 * underlaget när inget är valt), `antal` könen i urvalet och resten, `ok` om båda klarar regeln.
 * @param {any} underlag @param {Map<string, Set<string>>|null|undefined} filter
 * @returns {{ok: boolean, valet: any, valda: any[], antal: {urval: {kv: number, ma: number}, rest: {kv: number, ma: number}}}}
 */
export function underlagProva(underlag, filter) {
    const rader = (underlag && underlag.rader) || [];
    const valet = underlagValet(underlag, filter);
    const valbara = valet ? new Set(valet.valda) : null;
    const valda = valet && valbara ? rader.filter(r => { const v = underlagVarde(valet.dim, r); return v != null && valbara.has(v); }) : rader;
    const alla = underlagKonAntal(underlag, rader), urval = underlagKonAntal(underlag, valda);
    const rest = { kv: alla.kv - urval.kv, ma: alla.ma - urval.ma };
    return { ok: !valet || (underlagSkyddat(urval, underlag.k) && underlagSkyddat(rest, underlag.k)), valet, valda, antal: { urval, rest } };
}

/** Dimensionens namn mitt i en mening: liten första bokstav, utom när namnet börjar med en förkortning ('BAS-intervall'). @param {string} namn */
export function namnIMening(namn) {
    const s = String(namn || '');
    return s.length > 1 && s[1] === s[1].toLocaleLowerCase('sv') ? s[0].toLocaleLowerCase('sv') + s.slice(1) : s;
}

/**
 * Valet som text, t.ex. 'sektor Vård och omsorg' eller 'yrkesgrupp 5 av 40' (fler än tre valda), eller '' när
 * underlaget är helt.
 * @param {any} underlag @param {Map<string, Set<string>>|null|undefined} filter
 */
export function underlagBeskrivning(underlag, filter) {
    const valet = underlagValet(underlag, filter);
    if (!valet) return '';
    const namn = namnIMening(valet.dim.namn);
    if (!valet.valda.length) return `${namn}: inga`;
    return valet.valda.length <= 3 ? `${namn} ${valet.valda.join(', ')}` : `${namn} ${valet.valda.length} av ${valet.varden.length}`;
}

// Prövar figur.underlag (valideraFigur).
function _provaUnderlag(figur, fel) {
    const u = figur.underlag, vem = 'underlag';
    if (!u || typeof u !== 'object') fel(`${vem} måste vara { dimensioner, rader, rita, k, kon? }`);
    if (!Array.isArray(u.dimensioner) || !u.dimensioner.length) fel(`${vem}.dimensioner måste vara en lista med minst en dimension`);
    if (!Array.isArray(u.rader)) fel(`${vem}.rader måste vara en lista`);
    if (typeof u.rita !== 'function') fel(`${vem}.rita måste vara en funktion`);
    if (!(typeof u.k === 'number' && Number.isInteger(u.k) && u.k >= 1)) fel(`${vem}.k måste vara ett heltal ≥ 1`);
    if (u.kon != null && typeof u.kon !== 'function') fel(`${vem}.kon måste vara en funktion`);
    const text = v => typeof v === 'string' && v.trim() !== '';
    const sedda = new Set();
    u.dimensioner.forEach((d, i) => {
        const v = `${vem}.dimensioner ${i}`;
        if (!d || typeof d !== 'object') fel(`${v}: måste vara { falt, namn, varde?, etikett?, visning?, ordning? }`);
        if (d.typ != null && d.typ !== 'kategori') fel(`${v}: bara kategorier går att räkna för`);
        if (!text(d.falt) || !text(d.namn)) fel(`${v}: falt och namn måste vara icke-tomma strängar`);
        for (const f of ['varde', 'ordning']) if (d[f] != null && typeof d[f] !== 'function') fel(`${v}: ${f} måste vara en funktion`);
        if (d.etikett != null && typeof d.etikett !== 'string') fel(`${v}: etikett måste vara en sträng`);
        if (d.visning != null && d.visning !== 'lista') fel(`${v}: visning måste vara "lista"`);
        if (sedda.has(d.falt)) fel(`${v}: fältet "${d.falt}" förekommer två gånger`);
        sedda.add(d.falt);
    });
}

// Färgskalans domän: ett objekt med `doman` = två ändliga tal.
function _fargdomanOk(fs) {
    return !!fs && typeof fs === 'object' && Array.isArray(fs.doman) && fs.doman.length === 2
        && fs.doman.every(n => typeof n === 'number' && isFinite(n));
}

// Prövar lagrets datapunkter i ett enda varv: objekt, och på talaxlar ändliga tal (eller null/undefined).
function _provaData(l, i, figur, fel) {
    const talFalt = [];
    for (const a of ['x', 'y']) {
        const ax = a === 'y' && l.axel === 'y2' ? figur.y2 : figur[a];
        if (!ax || ax.skala === 'band') continue;
        for (const f of _falt(l, a)) talFalt.push(f);
        if ((l.marke === 'stapel' || l.marke === 'punkt') && _vardeaxel(l) === a) talFalt.push('fel.lag', 'fel.hog');
    }
    for (const f of ['varde', 'fargvarde', 'storlek', 'skillnadKr']) if (!talFalt.includes(f)) talFalt.push(f);
    const ok = v => v == null || (typeof v === 'number' && isFinite(v));
    for (let n = 0; n < l.data.length; n++) {
        const d = l.data[n];
        if (d === null || typeof d !== 'object') fel(`lager ${i}: datapunkt ${n} är inte ett objekt`);
        for (const f of talFalt) {
            const v = f.startsWith('fel.') ? (d.fel ? d.fel[f.slice(4)] : undefined) : d[f];
            if (!ok(v)) fel(`lager ${i}: datapunkt ${n}: fältet "${f}" måste vara ett ändligt tal (fick ${typeof v === 'string' ? `"${v}"` : String(v)})`);
        }
    }
}

// Ett härlett lager: { lager: [serie, …], berakna: punkter => data, minN?, namn?, villkor? }. Källorna är lagret
// självt (det läggs om ur sina egna punkter) eller andra lager som inte själva är härledda ur något annat; varje namn
// måste vara serien i minst ett sådant lager.
function _provaHarlett(figur, l, i, fel) {
    const h = l.harleddAv, vem = `lager ${i}: harleddAv`;
    if (!h || typeof h !== 'object') fel(`${vem} måste vara { lager, berakna, minN?, namn?, villkor? }`);
    if (!Array.isArray(h.lager) || !h.lager.length || !h.lager.every(s => typeof s === 'string' && s.trim() !== '')) fel(`${vem}.lager måste vara en lista med serienamn`);
    if (typeof h.berakna !== 'function') fel(`${vem}.berakna måste vara en funktion`);
    if (h.minN != null && !(typeof h.minN === 'number' && Number.isInteger(h.minN) && h.minN >= 0)) fel(`${vem}.minN måste vara ett heltal ≥ 0`);
    if (h.namn != null && typeof h.namn !== 'string') fel(`${vem}.namn måste vara en sträng`);
    if (h.villkor != null && typeof h.villkor !== 'function') fel(`${vem}.villkor måste vara en funktion`);
    const serier = new Set(figur.lager.filter((k, ki) => k && k.serie != null && (ki === i || _kanVaraKalla(k))).map(k => String(k.serie)));
    for (const s of h.lager) if (!serier.has(s)) fel(`${vem}: källagret "${s}" finns inte (eller är självt härlett)`);
}

/**
 * Kastar ett fel med diagrammets id och orsaken om figuren inte går att rita.
 * @returns figuren, oförändrad
 */
export function valideraFigur(figur, id = 'diagram') {
    const fel = m => { throw new Error(`Ogiltig figur (${id}): ${m}`); };
    if (!figur || typeof figur !== 'object') fel('figuren saknas');
    if (typeof figur.beskrivning !== 'string' || !figur.beskrivning.trim()) fel('beskrivning saknas');
    for (const a of ['x', 'y']) {
        if (!figur[a] || !SKALOR.includes(figur[a].skala)) fel(`axeln ${a} saknar giltig skala`);
    }
    for (const a of ['x', 'y', 'y2']) {
        const ax = figur[a];
        if (!ax || ax.skala === 'band' || ax.doman == null) continue;
        const d = ax.doman;
        const ok = Array.isArray(d) && d.length === 2 && d.every(n => typeof n === 'number' && isFinite(n)) && d[0] !== d[1]
            && (ax.skala !== 'log' || (d[0] > 0 && d[1] > 0));
        if (!ok) fel(`axeln ${a}: doman måste vara två olika ändliga tal${ax.skala === 'log' ? ' större än noll' : ''}`);
    }
    if (figur.y2 && figur.y2.skala !== 'linjar') fel('y2 måste ha skalan linjar');
    if (!Array.isArray(figur.lager) || !figur.lager.length) fel('lager saknas');
    // paneler: 'auto' — radpaneler för många kategorier: bara för en liggande figur med
    // kategorier på y, och lagren får då ingen egen panel.
    if (figur.paneler != null && !Array.isArray(figur.paneler) && figur.paneler !== 'auto') fel('paneler måste vara en lista eller "auto"');
    if (figur.paneler === 'auto') {
        if (!figur.y || figur.y.skala !== 'band') fel('paneler "auto" kräver bandskala på y');
        if (figur.lager.some(l => !(l.riktning === 'liggande' || l.marke === 'punkt') || l.panel != null)) fel('paneler "auto" kräver liggande lager (eller punkter) utan egen panel');
    }
    // urval: dimensioner användaren kan filtrera på (BAS-intervall, antal …). Bara märken döljs; inget räknas om.
    if (figur.urval != null) {
        if (typeof figur.urval !== 'object') fel('urval måste vara en dimension eller en lista med dimensioner');
        const text = v => typeof v === 'string' && v.trim() !== '';
        const sedda = new Set();
        _urvalRa(figur).forEach((u, i) => {
            const vem = `urval ${i}`;
            if (!u || typeof u !== 'object') fel(`${vem}: måste vara { typ?, falt, namn, etikett?, format?, visning? }`);
            const typ = _urvalTyp(u);
            if (!URVAL_TYPER.includes(typ)) fel(`${vem}: typ måste vara "kategori" eller "intervall"`);
            if (!text(u.falt) || !text(u.namn)) fel(`${vem}: falt och namn måste vara icke-tomma strängar`);
            if (u.etikett != null && typeof u.etikett !== 'string') fel(`${vem}: etikett måste vara en sträng`);
            if (u.format != null && (typ !== 'intervall' || !TALFORMAT.includes(u.format))) fel(`${vem}: format gäller bara intervall och måste vara ett av ${TALFORMAT.join(', ')}`);
            if (u.visning != null && (typ !== 'kategori' || u.visning !== 'lista')) fel(`${vem}: visning gäller bara kategori och måste vara "lista"`);
            if (sedda.has(u.falt)) fel(`${vem}: fältet "${u.falt}" förekommer två gånger`);
            sedda.add(u.falt);
        });
    }
    // underlag: diagrammet kan räknas om för en del av personerna (underlagProva m.fl. ovan).
    if (figur.underlag != null) _provaUnderlag(figur, fel);
    const paneler = Array.isArray(figur.paneler) ? figur.paneler : [];
    figur.lager.forEach((l, i) => {
        if (!l || !MARKEN.includes(l.marke)) fel(`lager ${i}: okänt märke "${l && l.marke}"`);
        if (!Array.isArray(l.data)) fel(`lager ${i}: data saknas`);
        if (l.axel === 'y2' && !figur.y2) fel(`lager ${i}: axeln y2 finns inte i figuren`);
        if (l.panel != null && !paneler.includes(l.panel)) fel(`lager ${i}: panelen "${l.panel}" finns inte`);
        if (l.tips != null && typeof l.tips !== 'function') fel(`lager ${i}: tips måste vara en funktion`);
        if (l.harleddAv != null) _provaHarlett(figur, l, i, fel);
        const behoverFarg = l.marke === 'ruta' || (l.marke === 'punkt' && l.data.some(d => d && d.fargvarde != null));
        if (behoverFarg && !figur.fargskala) fel(`lager ${i}: ${l.marke} med färgvärde kräver fargskala`);
        // Utan användbar domän kan ritaren inte färga något, och diagrammet skulle bli tomt utan fel. Lika tal är
        // tillåtna (ritaren vidgar domänen, som skalDoman gör för min === max); omvänd domän ger omvänd skala.
        if (behoverFarg && !_fargdomanOk(figur.fargskala)) fel('fargskala: doman måste vara två ändliga tal');
        // Lådor ritas bara stående (kategorin på x, värdet på y): en liggande låda skulle annars godkännas men aldrig ritas.
        // Ofylld (en ring utan fyllning) finns bara för punktsymbolerna med en yta: cirkel, romb och kvadrat.
        if (l.ofylld != null && !(typeof l.ofylld === 'boolean' && l.marke === 'punkt' && (!l.symbol || ['cirkel', 'romb', 'kvadrat'].includes(l.symbol)))) fel(`lager ${i}: ofylld måste vara true eller false och gäller bara punkt med symbolen cirkel, romb eller kvadrat`);
        if (l.monster != null && !(l.marke === 'stapel' && (l.monster === 'linjer' || l.monster === 'prickar'))) fel(`lager ${i}: monster måste vara "linjer" eller "prickar" och gäller bara stapel`);
        if (l.marke === 'lada' && l.riktning === 'liggande') fel(`lager ${i}: lada stöder bara stående riktning`);
        if (l.marke === 'lada' && l.form != null && !['fiol', 'regnmoln', 'kvantiler'].includes(l.form)) fel(`lager ${i}: form måste vara "fiol", "regnmoln" eller "kvantiler"`);
        if (l.antal != null && !(l.marke === 'lada' && l.form === 'kvantiler' && (l.antal === 20 || l.antal === 50))) fel(`lager ${i}: antal måste vara 20 eller 50 och gäller bara lada med form "kvantiler"`);
        // Staplar och lådor ritas per kategori och ruta i ett rutnät: kategorierna måste ligga på en bandskala.
        const kategori = l.riktning === 'liggande' ? 'y' : 'x';
        if ((l.marke === 'stapel' || l.marke === 'lada') && figur[kategori].skala !== 'band') fel(`lager ${i}: ${l.marke} kräver bandskala på kategoriaxeln (${kategori})`);
        if (l.marke === 'ruta' && (figur.x.skala !== 'band' || figur.y.skala !== 'band')) fel(`lager ${i}: ruta kräver bandskala på både x och y`);
        if (l.marke === 'yta' && (figur.x.skala === 'band' || figur.y.skala === 'band')) fel(`lager ${i}: yta kräver talaxlar på både x och y`);
        _provaData(l, i, figur, fel);
    });
    for (const a of ['x', 'y']) {
        if (figur[a].skala !== 'log') continue;
        if (axelVarden(figur, a).some(v => typeof v === 'number' && v <= 0)) fel(`axeln ${a} är logaritmisk och kräver värden större än noll`);
    }
    return figur;
}

const _cell = v => (v == null || (typeof v === 'number' && !isFinite(v))) ? '' : v;
function _serienamn(figur, l, i) {
    let namn = l.serie ? String(l.serie) : `Serie ${i + 1}`;
    // Ett lager på högra axeln skulle annars läsas under vänsteraxelns rubrik.
    if (l.axel === 'y2') namn += figur.y2 && figur.y2.titel ? ` (höger axel: ${figur.y2.titel})` : ' (höger axel)';
    return l.panel != null ? `${namn} · ${l.panel}` : namn;
}

/**
 * Figuren som rad-matris för CSV och urklipp. `ruta` blir en korstabell per lager; övriga
 * märken långt format (Serie | x | y, och Undre | Övre när figuren har band, intervall,
 * felstaplar eller lådor). En `lada` skrivs ALDRIG som individer (dataminimering): en rad per
 * kategori med lådans statistik — median under y, första kvartilen under Undre och tredje
 * under Övre — i axelns ordning, för båda `punkter`-lägena. Anroparen ansvarar för små
 * grupper (utanSmaGrupper; statistiken räknas då bara ur det som finns kvar) och spårbarhetsraden.
 * @returns {Array<Array<string|number>>}
 */
export function figurTillTabell(figur) {
    const block = [];
    // En null-post i data hoppas över (ovaliderad indata ska inte kasta).
    figur = { ...figur, lager: figur.lager.map(l => ({ ...l, data: (l.data || []).filter(d => d != null) })) };
    figur.lager.forEach((l, i) => {
        if (l.marke !== 'ruta' || !l.data.length) return;
        const en = { ...figur, lager: [l] };
        const xs = skalDoman({ ...en, x: { ...figur.x, skala: 'band' } }, 'x');
        const ys = skalDoman({ ...en, y: { ...figur.y, skala: 'band' } }, 'y');
        const cell = new Map(l.data.map(d => [String(d.x) + '\u0000' + String(d.y), d.varde]));
        const b = [[_serienamn(figur, l, i), ...xs]];
        for (const y of ys) b.push([y, ...xs.map(x => _cell(cell.get(x + '\u0000' + y)))]);
        block.push(b);
    });

    // Ett lager märkt `utanData` bär bara etiketter till värden som redan står i ett annat lager, och får inga rader.
    const ovriga = figur.lager.map((l, i) => [l, i]).filter(([l]) => l.marke !== 'ruta' && l.data.length && !l.utanData);
    if (ovriga.length) {
        const spann = ovriga.some(([l]) => l.marke === 'band' || l.marke === 'intervall' || l.marke === 'lada' || l.data.some(d => d.fel));
        const xOrdning = ovriga.some(([l]) => l.marke === 'lada') ? skalDoman({ ...figur, x: { ...figur.x, skala: 'band' } }, 'x') : [];
        const rubrik = ['Serie', (figur.x && figur.x.titel) || 'x', (figur.y && figur.y.titel) || 'y'];
        if (spann) rubrik.push('Undre', 'Övre');
        // Skillnaden i kronor (kronorSkillnad) får en egen kolumn när någon punkt bär den.
        const kronor = ovriga.some(([l]) => l.data.some(d => typeof d.skillnadKr === 'number'));
        if (kronor) rubrik.push('Skillnad (kr/mån)');
        const b = [rubrik];
        for (const [l, i] of ovriga) {
            const harSpann = l.marke === 'band' || l.marke === 'intervall';
            const liggande = l.riktning === 'liggande';
            if (l.marke === 'yta') {
                // En yta bär ett namn och ett värde, inte ett läge: raden är Serie | namn | värde.
                for (const d of l.data) { const rad = [_serienamn(figur, l, i), _cell(d.namn != null ? d.namn : d.etikett), _cell(d.varde)]; if (spann) rad.push('', ''); if (kronor) rad.push(''); b.push(rad); }
                continue;
            }
            if (l.marke === 'lada') {
                const grupper = new Map();
                for (const d of l.data) {
                    const k = String(d.x);
                    if (!grupper.has(k)) grupper.set(k, []);
                    grupper.get(k).push(d.y);
                }
                if (l.form === 'kvantiler') {
                    // Kvantilpunkter: en rad per prick med kvantilens värde — aldrig individer.
                    for (const k of xOrdning) {
                        const kp = grupper.has(k) ? kvantilpunkter(grupper.get(k), l.antal || 20) : null;
                        if (kp) kp.varden.forEach((v, j) => b.push([_serienamn(figur, l, i), `${k} · ${j + 1}/${kp.antal}`, v, '', '', ...(kronor ? [''] : [])]));
                    }
                    continue;
                }
                for (const k of xOrdning) {
                    const st = grupper.has(k) ? ladstatistik(grupper.get(k)) : null;
                    if (st) b.push([_serienamn(figur, l, i), k, st.median, st.q1, st.q3, ...(kronor ? [''] : [])]);
                }
                continue;
            }
            for (const d of l.data) {
                // Ett spann ligger längs värdeaxeln; den cellen lämnas tom och gränserna står i Undre/Övre.
                // Ett lager märkt `absolut` ritas åt det negativa hållet (divergerande stapel) men bär en storlek:
                // värdet skrivs utan tecken.
                const abs = (v, varde) => (l.absolut && varde && typeof v === 'number' ? Math.abs(v) : v);
                const x = harSpann && l.marke === 'intervall' && liggande ? '' : _cell(abs(d.x, liggande));
                const y = harSpann && !(l.marke === 'intervall' && liggande) ? '' : _cell(abs(d.y, !liggande));
                const rad = [_serienamn(figur, l, i), x, y];
                if (spann) {
                    const g = harSpann ? d : (d.fel || {});
                    rad.push(_cell(g.lag), _cell(g.hog));
                }
                if (kronor) rad.push(_cell(d.skillnadKr));
                b.push(rad);
            }
        }
        block.push(b);
    }

    const ut = [];
    block.forEach((b, i) => { if (i) ut.push([]); ut.push(...b); });
    return ut;
}

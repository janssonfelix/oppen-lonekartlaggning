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
    const paneler = Array.isArray(figur.paneler) ? figur.paneler : [];
    figur.lager.forEach((l, i) => {
        if (!l || !MARKEN.includes(l.marke)) fel(`lager ${i}: okänt märke "${l && l.marke}"`);
        if (!Array.isArray(l.data)) fel(`lager ${i}: data saknas`);
        if (l.axel === 'y2' && !figur.y2) fel(`lager ${i}: axeln y2 finns inte i figuren`);
        if (l.panel != null && !paneler.includes(l.panel)) fel(`lager ${i}: panelen "${l.panel}" finns inte`);
        if (l.tips != null && typeof l.tips !== 'function') fel(`lager ${i}: tips måste vara en funktion`);
        const behoverFarg = l.marke === 'ruta' || (l.marke === 'punkt' && l.data.some(d => d && d.fargvarde != null));
        if (behoverFarg && !figur.fargskala) fel(`lager ${i}: ${l.marke} med färgvärde kräver fargskala`);
        // Utan användbar domän kan ritaren inte färga något, och diagrammet skulle bli tomt utan fel. Lika tal är
        // tillåtna (ritaren vidgar domänen, som skalDoman gör för min === max); omvänd domän ger omvänd skala.
        if (behoverFarg && !_fargdomanOk(figur.fargskala)) fel('fargskala: doman måste vara två ändliga tal');
        // Lådor ritas bara stående (kategorin på x, värdet på y): en liggande låda skulle annars godkännas men aldrig ritas.
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

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — rapportunderlag (ADR-20).
 *
 * Ren logik bakom panelen Rapportunderlag: vilka yrkesgrupper Lika arbete flaggar
 * (samma regel som EU-tabellen, som använder den här funktionen), justerat gap inom
 * ett yrke, och block med faktastycke, tabell och frågor som kopieras in i en egen
 * Word-mall. Bedömningen (sakliga skäl) skrivs inte här — den kräver kunskap som
 * bara verksamheten har.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { median, quantile, fitOLS } from './stat.js';
import { skrDelText } from './skrreferens.js';

const _arKvinna = r => typeof r.kon === 'string' && r.kon.includes('kvinna');
const _arMan = r => typeof r.kon === 'string' && !r.kon.includes('kvinna') && (r.kon.includes('man') || r.kon.includes('män'));

/**
 * Yrkesgrupperna i Lika arbete (samma jämförelseenhet och k-regler som EU-tabellen).
 * @param {any[]} rader
 * @param {{k:number, troskel?:number}} opts
 * @returns {{grupper: any[], utelamnade: string[], ejJamforbara: string[]}}
 */
export function likaArbeteGrupper(rader, { k, troskel = 5 }) {
    const perYrke = new Map();
    for (const r of rader || []) {
        if (!perYrke.has(r.yrke)) perYrke.set(r.yrke, { kv: [], ma: [] });
        if (_arKvinna(r)) perYrke.get(r.yrke).kv.push(r.lon);
        else if (_arMan(r)) perYrke.get(r.yrke).ma.push(r.lon);
    }
    const grupper = [], utelamnade = [], ejJamforbara = [];
    for (const [yrke, { kv, ma }] of perYrke) {
        if (kv.length < 2 || ma.length < 2) { ejJamforbara.push(yrke); continue; }
        const tot = kv.length + ma.length;
        const nagotLitet = kv.length < k || ma.length < k;
        if (nagotLitet && tot < k) { utelamnade.push(yrke); continue; }
        if (nagotLitet) {
            grupper.push({ yrke, nKv: kv.length, nMa: ma.length, tot, samladMedian: true, flaggad: false,
                gapPct: 0, medTot: median(kv.concat(ma)) });
            continue;
        }
        const medKv = median(kv), medMa = median(ma);
        const kvot = medKv / medMa;
        const gapPct = Math.abs(kvot * 100 - 100);
        const g = { yrke, nKv: kv.length, nMa: ma.length, tot, samladMedian: false,
            medKv, medMa, kvot, gapPct, flaggad: gapPct > troskel,
            p10Kv: quantile(kv, 0.1), p90Kv: quantile(kv, 0.9), p10Ma: quantile(ma, 0.1), p90Ma: quantile(ma, 0.9) };
        if (g.flaggad) g.stabilitet = _stabilitet(kv, ma, { k, troskel });
        grupper.push(g);
    }
    grupper.sort((a, b) => b.gapPct - a.gapPct);
    return { grupper, utelamnade, ejJamforbara };
}

/**
 * Könsgap inom ett yrke efter hänsyn till ålder (och BAS när yrket finns i flera BAS):
 * OLS på log(lön). Kräver båda könen ≥ k och n ≥ antal parametrar + 5.
 * @param {any[]} rader
 * @param {{k:number}} opts
 * @returns {{gapPct: number, n: number} | {forFa: true} | {ejSkattbar: true}}
 */
export function justeratGapInomYrke(rader, { k }) {
    const d = (rader || []).filter(r => r.lon > 0 && r.alder > 0 && (_arKvinna(r) || _arMan(r)));
    const nKv = d.filter(_arKvinna).length, nMa = d.length - nKv;
    if (nKv < k || nMa < k) return { forFa: true };
    const basLista = [...new Set(d.map(r => r.bas))].sort();
    const dummies = basLista.slice(1);
    const p = 3 + dummies.length;
    if (d.length < p + 5) return { forFa: true };
    const X = d.map(r => [1, _arKvinna(r) ? 1 : 0, r.alder, ...dummies.map(b => (r.bas === b ? 1 : 0))]);
    const y = d.map(r => Math.log(r.lon));
    const fit = fitOLS(X, y);
    // Singulär modell: kön och BAS sammanfaller inom yrket (t.ex. alla kvinnor i ett BAS).
    if (!fit || !isFinite(fit.beta[1])) return { ejSkattbar: true };
    return { gapPct: (Math.exp(fit.beta[1]) - 1) * 100, n: d.length };
}

// ---- Block: faktastycke, tabell, redan prövat, frågor ----

export const FRAGOR_YRKE = Object.freeze([
    'Har kvinnor och män i gruppen olika uppdrag, ansvar eller arbetsinnehåll?',
    'Finns individuella lönetillägg eller särskilda uppdrag (marknad, bristyrke, specialistroll)?',
    'Hur har lönen satts vid nyanställning under de senaste åren, och skiljer det sig mellan könen?',
    'Finns skillnader i erfarenhet, kompetens eller utbildning som påverkar lönesättningen?',
    'Hur har lönekriterierna tillämpats vid den senaste lönerevisionen?',
    'Finns tidsbegränsade eller personliga lösningar (t.ex. garantilön, lönetrappa) i gruppen?',
]);
export const FRAGOR_PAR = Object.freeze([
    'Ställer yrkena likvärdiga krav på kunskap och färdigheter, ansvar, ansträngning och arbetsförhållanden?',
    'Stämmer BAS-placeringen med befattningsbeskrivningarna?',
    'Finns marknadsfaktorer eller rekryteringsläge som påverkar jämförelseyrket?',
    'Finns skillnader i arbetstid, arbetsmiljö eller ansvar som inte syns i BAS?',
]);

/** Svenskt talformat (decimalkomma, hårt mellanslag som tusentalsavgränsare). */
export function formatTal(v, dec = 0) {
    if (v == null || !isFinite(v)) return '–';
    const t = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
    // Ett negativt tal som avrundas till noll ska inte bli "−0" (samma avrundning som övriga tabeller).
    return /^[-−]0(,0+)?$/.test(t) ? t.slice(1) : t;
}
const _st = (n, en, flera) => `${formatTal(n)} ${n === 1 ? en : flera}`;
const _kr = v => (v == null || !isFinite(v)) ? '–' : `${formatTal(v, 0)} kr`;
const _pct = (v, dec = 1) => (v == null || !isFinite(v)) ? '–' : `${formatTal(v, dec)} %`;
const _ki = (lo, hi) => (lo < 0 || hi < 0) ? `${formatTal(lo, 1)} till ${formatTal(hi, 1)}` : `${formatTal(lo, 1)}–${formatTal(hi, 1)}`;
// Beräkningen tar bara fram de topN största paren. Nåddes gränsen (räknat före k-filtret)
// kan fler finnas, och antalet i texten är då ett tak, inte hela antalet.
const _kapad = u => !!u.topN && (u.par || []).length + (u.exkluderade || 0) >= u.topN;
const _kapadText = u => `Fler kan finnas: beräkningen tar fram de ${u.topN} största paren, och maxantalet ändras i Likvärdigt arbete.`;
const _inled = ({ demo, urval, troskelNot }) => ({
    fore: demo ? ['DEMODATA — inte verkliga löner.'] : [],
    efter: [...(urval ? [`Urval: ${urval}.`] : []), ...(troskelNot ? [troskelNot] : [])],
});

// ---- Stabilitet för flaggor (ADR-24) ----
// Median av en sorterad lista utan positionerna i `bort` (stigande, unika).
function _medianUtanPos(s, bort) {
    const n = s.length - bort.length;
    const vid = p => { let q = p; for (const b of bort) { if (b <= q) q++; else break; } return s[q]; };
    return n % 2 ? vid((n - 1) / 2) : (vid(n / 2 - 1) + vid(n / 2)) / 2;
}
// Ytterlägen och positioner inom 2 från medianen — övriga borttagningar ger samma median
// som något av ytterlägena.
function _kandidater(n) {
    const set = new Set([0, n - 1]);
    for (let i = Math.floor((n - 1) / 2) - 2; i <= Math.ceil((n - 1) / 2) + 2; i++) if (i >= 0 && i < n) set.add(i);
    return [...set].sort((a, b) => a - b);
}
function _stabilitet(kv, ma, { k, troskel }) {
    const sKv = [...kv].sort((a, b) => a - b), sMa = [...ma].sort((a, b) => a - b);
    const cKv = _kandidater(sKv.length), cMa = _kandidater(sMa.length);
    const gap = (bKv, bMa) => Math.abs(_medianUtanPos(sKv, bKv) / _medianUtanPos(sMa, bMa) * 100 - 100);
    const par = c => c.flatMap((a, i) => c.slice(i + 1).map(b => [a, b]));
    const kanKv = m => sKv.length - m >= k, kanMa = m => sMa.length - m >= k;
    let min1 = Infinity, min2 = Infinity;
    if (kanKv(1)) for (const i of cKv) min1 = Math.min(min1, gap([i], []));
    if (kanMa(1)) for (const j of cMa) min1 = Math.min(min1, gap([], [j]));
    if (kanKv(2)) for (const p of par(cKv)) min2 = Math.min(min2, gap(p, []));
    if (kanMa(2)) for (const p of par(cMa)) min2 = Math.min(min2, gap([], p));
    if (kanKv(1) && kanMa(1)) for (const i of cKv) for (const j of cMa) min2 = Math.min(min2, gap([i], [j]));
    const begransad = !kanKv(1) && !kanMa(1) ? 'bada' : !kanKv(1) ? 'kvinnor' : !kanMa(1) ? 'man' : null;
    if (begransad === 'bada') return { niva: 'stabil', lagstaGapPct: null, begransad, provadeMax: 0 };
    const niva = min1 <= troskel ? 'skor1' : min2 <= troskel ? 'skor2' : 'stabil';
    const lagstaGapPct = niva === 'skor1' ? min1 : (Number.isFinite(min2) ? min2 : min1);
    // provadeMax: flest borttagna som faktiskt kunde prövas (k-gränsen kan stoppa två).
    return { niva, lagstaGapPct, begransad, provadeMax: Number.isFinite(min2) ? 2 : 1 };
}
const _tillagg = st => st.begransad === 'kvinnor' ? ' (prövat bara på män)' : st.begransad === 'man' ? ' (prövat bara på kvinnor)' : '';

/** Kort märkning för tabellen i Lika arbete. */
export function stabilitetKort(st, k) {
    if (!st) return '';
    if (st.begransad === 'bada') return `Kan inte prövas: båda könen har exakt ${k} personer`;
    const t = _tillagg(st);
    if (st.niva === 'skor1') return `Skör: kan bli ${formatTal(st.lagstaGapPct, 1)} % om 1 person tas bort${t}`;
    if (st.niva === 'skor2') return `Skör: kan bli ${formatTal(st.lagstaGapPct, 1)} % om 2 personer tas bort${t}`;
    if (st.provadeMax === 1) return `Stabil: över 5 % även utan 1 person, fler kunde inte prövas${t}`;
    return `Stabil: över 5 % även utan 2 personer${t}`;
}
function _kanslighet(st, k) {
    if (st.begransad === 'bada') return `Känslighet: kunde inte prövas eftersom båda könen har exakt ${k} personer.`;
    const t = _tillagg(st);
    if (st.niva === 'skor1') return `Känslighet: skillnaden kan sjunka till ${_pct(st.lagstaGapPct)} om en person tas bort${t}.`;
    if (st.niva === 'skor2') return `Känslighet: skillnaden kan sjunka till ${_pct(st.lagstaGapPct)} om två personer tas bort${t}.`;
    if (st.provadeMax === 1) return `Känslighet: skillnaden ligger kvar över 5 % även om en person tas bort; fler kunde inte prövas${t}.`;
    return `Känslighet: skillnaden ligger kvar över 5 % även om två personer tas bort${t}.`;
}

/**
 * Block för en flaggad yrkesgrupp i Lika arbete.
 * @param {any} g
 * @param {{id?:string, justerat?:any, ki?:any, urval?:any, demo?:boolean, k?:number, troskelNot?:string|null, arsbelopp?:string|null}} [opts]
 */
export function gruppBlock(g, { id, justerat, ki, urval, demo, k = 10, troskelNot, arsbelopp } = {}) {
    const { fore, efter } = _inled({ demo, urval, troskelNot });
    let fakta = `Inom ${g.yrke} (n = ${g.tot}, varav ${g.nKv} kvinnor och ${g.nMa} män) är kvinnornas medianlön `
        + `${_pct(g.kvot * 100)} av männens` + (ki ? ` (95 % KI ${_ki(ki.lo, ki.hi)})` : '') + '.';
    let provat;
    if (justerat && justerat.ejSkattbar) {
        provat = ['Ålder och BAS kunde inte prövas eftersom kön och BAS sammanfaller i yrket (kvinnor och män finns i olika BAS).'];
    } else if (justerat && !justerat.forFa) {
        fakta += ` Efter hänsyn till ålder och BAS inom yrket återstår en skillnad på ${_pct(justerat.gapPct)}.`;
        const ra = (g.kvot - 1) * 100, ju = justerat.gapPct;
        const siffror = `(${_pct(ra)} före justering, ${_pct(ju)} efter)`;
        if (ra !== 0 && ju !== 0 && Math.sign(ra) !== Math.sign(ju)) {
            provat = [`Efter hänsyn till ålder och BAS inom yrket byter skillnaden tecken ${siffror}. Råskillnaden och den justerade skillnaden mäter olika saker (median respektive genomsnitt i en modell) och bör läsas var för sig.`];
        } else if (Math.abs(ju) < Math.abs(ra)) {
            provat = [`Ålder och BAS inom yrket förklarar ${formatTal(Math.abs(ra) - Math.abs(ju), 1)} procentenheter av skillnaden ${siffror}.`];
        } else {
            provat = [`Ålder och BAS inom yrket förklarar inte skillnaden ${siffror}.`];
        }
    } else {
        provat = ['För få personer för att justera för ålder och BAS.'];
    }
    if (g.stabilitet) provat = [...provat, _kanslighet(g.stabilitet, k)];
    return {
        id, rubrik: g.yrke,
        // arsbelopp: räkneexemplet i kronor per år, byggt av anroparen.
        stycken: [...fore, fakta, ...(arsbelopp ? [arsbelopp] : []), ...efter],
        tabell: { rubriker: ['', 'Antal', 'P10', 'Median', 'P90'], rader: [
            ['Kvinnor', String(g.nKv), _kr(g.p10Kv), _kr(g.medKv), _kr(g.p90Kv)],
            ['Män', String(g.nMa), _kr(g.p10Ma), _kr(g.medMa), _kr(g.p90Ma)]] },
        provat, fragor: [...FRAGOR_YRKE],
    };
}

/**
 * Block för ett kandidatpar i Likvärdigt arbete.
 * @param {any} p
 * @param {{id?:string, kravProxy?:any, urval?:any, demo?:boolean, troskelNot?:string|null}} [opts]
 */
export function parBlock(p, { id, kravProxy, urval, demo, troskelNot } = {}) {
    const { fore, efter } = _inled({ demo, urval, troskelNot });
    const kiPct = p.gapCI && p.kvMedian > 0 ? { lo: p.gapCI.lo / p.kvMedian * 100, hi: p.gapCI.hi / p.kvMedian * 100 } : null;
    const fakta = `${p.kvLabel} (BAS ${p.kvBas}, ${formatTal(p.kvKvinnoPct, 0)} % kvinnor, median ${_kr(p.kvMedian)}) har `
        + `${_kr(p.gapKr)} lägre medianlön än ${p.maLabel} (BAS ${p.maBas}, median ${_kr(p.maMedian)}). `
        + `Jämförelseyrkets median ligger ${_pct(p.gapPct)} högre` + (kiPct ? ` (95 % KI ${_ki(kiPct.lo, kiPct.hi)} %)` : '') + '.'
        // Den råa skillnaden är det lagen prövar; den åldersjusterade (bara interna par) visar vad som kan bero på åldersstruktur.
        + (p.aldersJusterad && isFinite(p.aldersJusterad.gapPct) ? ` Justerat för ålder: ${_pct(p.aldersJusterad.gapPct)}.` : '');
    const proxy = kravProxy === 'poäng'
        ? 'Jämförelsen bygger på arbetsvärderingspoäng som mått på krav.'
        : 'Jämförelsen bygger på BAS-intervall som mått på krav.';
    const kalla = p.jamforKalla === 'extern' ? ' Jämförelseyrket kommer från jämförelsestatistiken.' : '';
    return {
        id, rubrik: `${p.kvLabel} — ${p.maLabel}`,
        stycken: [...fore, fakta, proxy + kalla, ...efter],
        tabell: { rubriker: ['Yrke', 'BAS', 'Andel kvinnor', 'Antal', 'Median'], rader: [
            [p.kvLabel, p.kvBas, _pct(p.kvKvinnoPct, 0), String(p.kvN), _kr(p.kvMedian)],
            [p.maLabel, p.maBas, _pct(p.maKvAndel, 0), p.maN == null ? '–' : String(p.maN), _kr(p.maMedian)]] },
        provat: null, fragor: [...FRAGOR_PAR],
    };
}

/** Avsnittsblock per lagsteg: 'sammanfattning' | 'uppdelning' | 'lika' | 'likvardigt' | 'lagreKrav' | 'struktur' | 'handlingsplan'. */
/**
 * @param {string} typ
 * @param {any} u
 * @param {{k:number, urval?:any, demo?:boolean, troskelNot?:string|null}} opts
 */
export function avsnittBlock(typ, u, { k, urval, demo, troskelNot }) {
    const { fore, efter } = _inled({ demo, urval, troskelNot });
    const blk = (rubrik, stycken, tabell) => ({ id: typ, rubrik, stycken: [...fore, ...stycken, ...efter], tabell, provat: null, fragor: null });
    if (typ === 'sammanfattning') {
        // k-anonymitet: med ett kön under k i urvalet redovisas inga könsuppdelade lönemått.
        const litet = u.nKv < k || u.nMa < k;
        const kvot = !litet && u.medMa > 0 ? u.medKv / u.medMa * 100 : null;
        const st = [`Underlaget omfattar ${formatTal(u.n)} anställda, varav ${formatTal(u.nKv)} kvinnor och ${formatTal(u.nMa)} män.`
            + (litet ? ` Könsuppdelade lönemått redovisas inte eftersom ett kön har färre än ${k} personer i urvalet.`
                     : ` Kvinnornas medianlön är ${_kr(u.medKv)} och männens ${_kr(u.medMa)}, vilket motsvarar ${_pct(kvot)} av männens.`)];
        if (u.oforklarat && !litet) {
            st.push(u.oforklarat.medBas === false
                ? `Efter hänsyn till ålder är det oförklarade lönegapet ${_pct(u.oforklarat.pct)} (95 % KI ${_ki(u.oforklarat.lo, u.oforklarat.hi)} %). BAS-intervall kunde inte tas med i modellen.`
                : `Efter hänsyn till ålder och BAS är det oförklarade lönegapet ${_pct(u.oforklarat.pct)} (95 % KI ${_ki(u.oforklarat.lo, u.oforklarat.hi)} %).`);
        }
        if (u.kvalitet) {
            const etikett = { ok: 'OK', varning: 'Varning', kritisk: 'Kritisk' }[u.kvalitet.status];
            st.push(`Underlagets kvalitet: ${etikett}` + (u.kvalitet.brister.length ? ` (${u.kvalitet.brister.join(', ')}).` : '.'));
        }
        const rader = [['Antal anställda', formatTal(u.n)], ['Kvinnor', formatTal(u.nKv)], ['Män', formatTal(u.nMa)]];
        if (!litet) {
            rader.push(['Medianlön kvinnor', _kr(u.medKv)], ['Medianlön män', _kr(u.medMa)], ['Kvinnors lön i % av mäns', _pct(kvot)]);
            if (u.oforklarat) rader.push([u.oforklarat.medBas === false ? 'Oförklarat lönegap (ålder)' : 'Oförklarat lönegap (ålder och BAS)', _pct(u.oforklarat.pct)]);
        }
        return blk('Sammanfattning', st, { rubriker: ['Nyckeltal', 'Värde'], rader });
    }
    if (typ === 'uppdelning') {
        const R = 'Var uppstår löneskillnaden?';
        if (!u) return blk(R, [`För få personer för att dela upp skillnaden: ett kön har färre än ${k} personer i urvalet.`], null);
        const inledning = `Männens medellön är ${_kr(u.medel.ma)} och kvinnornas ${_kr(u.medel.kv)}, en skillnad på ${_kr(u.gap)} (${_pct(u.gapPct)} av männens).`;
        if (u.skyddad === false) return blk(R, [inledning, `Skillnaden delas inte upp här: en grupp med färre än ${k} personer står för så stor del av en av delarna att dess bidrag annars skulle kunna räknas fram.`], null);
        const { A, B, C } = u.delar;
        const st = [`${inledning} Positiva belopp betyder att männens medellön är högre.`,
            `Av skillnaden beror ${_kr(A)} på att kvinnor och män är olika fördelade över BAS, ${_kr(B)} på olika AID inom samma BAS och ${_kr(C)} på löneskillnader inom samma AID och BAS.`];
        if (u.litetGap) st.push('Skillnaden är mindre än 1 % av männens medellön. Delarna kan då peka åt olika håll och vara större än själva skillnaden.');
        const andel = v => u.litetGap ? '—' : _pct(v / u.gap * 100, 0);
        // Samma poster som kortet: listan är redan kortad efter skyddsregeln, och en kortare
        // lista här kunde bryta den (gapuppdelning.js).
        const storst = d => u.topp[d].map(p => `${p.namn} (${_kr(p.kr)})`).join('; ') || '—';
        return blk(R, st, { rubriker: ['Del', 'Bidrag (kr)', 'Andel av skillnaden', 'Störst bidrag'], rader: [
            ['BAS-fördelning', _kr(A), andel(A), storst('A')],
            ['AID inom BAS', _kr(B), andel(B), storst('B')],
            ['Inom AID och BAS', _kr(C), andel(C), storst('C')],
            ['Totalt', _kr(u.gap), u.litetGap ? '—' : '100 %', ''],
        ] });
    }
    if (typ === 'lika') {
        const g = u.grupper || [];
        const flagg = g.filter(x => x.flaggad), samlade = g.filter(x => x.samladMedian);
        const jamforda = g.length + (u.utelamnade || []).length;
        const st = [`${_st(jamforda, 'yrkesgrupp', 'yrkesgrupper')} jämfördes. ${flagg.length} har en skillnad över 5 % mellan kvinnors och mäns medianlön. `
            + `${samlade.length} redovisas med samlad median eftersom ett kön har färre än ${k} personer, och ${(u.utelamnade || []).length} utelämnas helt.`];
        if (!flagg.length) return blk('Lika arbete', [...st, 'Ingen yrkesgrupp har en skillnad över 5 %.'], null);
        return blk('Lika arbete', st, { rubriker: ['Yrkesgrupp', 'Kvinnor', 'Män', 'Median kvinnor', 'Median män', 'Kvinnors lön i % av mäns'],
            rader: flagg.map(x => [x.yrke, String(x.nKv), String(x.nMa), _kr(x.medKv), _kr(x.medMa), _pct(x.kvot * 100)]) });
    }
    if (typ === 'likvardigt') {
        const par = u.par || [];
        const proxy = u.kravProxy === 'poäng' ? 'arbetsvärderingspoäng' : 'BAS-intervall';
        const st = [(_kapad(u) ? `De ${u.topN} största kandidatparen` : `${par.length} kandidatpar`)
            + ` där ett kvinnodominerat yrke har lägre medianlön än ett yrke med lika eller lägre krav. Kraven mäts med ${proxy}.`
            + (u.kvinnoTroskel != null ? ` Ett yrke räknas som kvinnodominerat vid minst ${formatTal(u.kvinnoTroskel)} % kvinnor.` : '')];
        if (_kapad(u)) st.push(_kapadText(u));
        if (u.exkluderade) st.push(`${u.exkluderade} par med en grupp under ${k} personer redovisas inte här.`);
        if (!par.length) return blk('Likvärdigt arbete', [...st, 'Inga kandidatpar att redovisa.'], null);
        const kiText = p => (p.gapCI && p.kvMedian > 0) ? `${_ki(p.gapCI.lo / p.kvMedian * 100, p.gapCI.hi / p.kvMedian * 100)} %` : '–';
        return blk('Likvärdigt arbete', st, { rubriker: ['Kvinnodominerat yrke', 'Jämförelseyrke', 'Skillnad (kr)', 'Skillnad (%)', '95 % KI'],
            rader: par.map(p => [`${p.kvLabel} (BAS ${p.kvBas})`, `${p.maLabel} (BAS ${p.maBas})`, _kr(p.gapKr), _pct(p.gapPct), kiText(p)]) });
    }
    if (typ === 'lagreKrav') {
        const R = 'Lägre krav, högre lön';
        if (u.kravProxy === 'poäng') return blk(R, ['Med arbetsvärderingspoäng jämförs yrken över BAS-gränserna redan i Likvärdigt arbete.'], null);
        const par = u.par || [];
        const st = [(_kapad(u) ? `De ${u.topN} största paren` : `${par.length} par`)
            + ' där ett kvinnodominerat yrke har lägre medianlön än ett av organisationens yrken i lägre BAS. Kraven mäts med BAS-intervall, ett grovt mått som bör prövas mot befattningsbeskrivningarna.'];
        if (_kapad(u)) st.push(_kapadText(u));
        if (u.exkluderade) st.push(`${u.exkluderade} par med en grupp under ${k} personer redovisas inte här.`);
        if (!par.length) return blk(R, [...st, 'Inget kvinnodominerat yrke har lägre medianlön än ett yrke i lägre BAS.'], null);
        const kiText = p => (p.gapCI && p.kvMedian > 0) ? `${_ki(p.gapCI.lo / p.kvMedian * 100, p.gapCI.hi / p.kvMedian * 100)} %` : '–';
        const b = blk(R, st, { rubriker: ['Kvinnodominerat yrke', 'Jämförelseyrke', 'BAS-steg', 'Skillnad (kr)', 'Skillnad (%)', '95 % KI'],
            rader: par.map(p => [`${p.kvLabel} (BAS ${p.kvBas})`, `${p.maLabel} (BAS ${p.maBas})`, String(p.basSteg), _kr(p.gapKr), _pct(p.gapPct), kiText(p)]) });
        return { ...b, fragor: [...FRAGOR_PAR] };
    }
    if (typ === 'struktur') {
        const kv = u.kvartiler || [];
        const st = ['Könsfördelning och medianlön per BAS-intervall.'];
        const kvartilOk = !(u.nKv < k || u.nMa < k);   // k: kvartilandelar röjer annars ett litet kön
        if (kv.length && kvartilOk) st.push('Andel kvinnor per lönekvartil: ' + kv.map(q => `kvartil ${q.q} ${_pct(q.andelKv, 0)}`).join(', ') + '.');
        const rep = u.representation || [];
        const utelamnade = rep.filter(r => r.n < k).length;
        if (utelamnade) st.push(`${_st(utelamnade, 'BAS-intervall', 'BAS-intervall')} med färre än ${k} personer redovisas inte.`);
        return blk('Struktur och lönetransparens', st, { rubriker: ['BAS', 'Antal', 'Andel kvinnor', 'Median', 'Kvinnors lön jämfört med mäns'],
            rader: rep.filter(r => r.n >= k).map(r => [r.bas, String(r.n), _pct(r.andelKv),
                _kr(r.median),
                (r.nKv >= k && r.nMa >= k && r.gapPct != null) ? _pct(r.gapPct) : '–']) });
    }
    if (typ === 'sektorer') {
        // Sektorsöversikten (ADR-33): samma k-regler som vyn.
        const alla = u.sektorer || [];
        const visas = alla.filter(r => !r.maskerad);
        const st = ['Kvinnors lön i procent av mäns per sektor (AID-huvudområde), rå och justerad för ålder och BAS-intervall.'];
        const a = u.andel;
        if (a && a.andel != null) st.push(Math.abs(a.andel) < 0.01
            ? `Skillnaden i medellön för hela organisationen (${_kr(a.gapKr)} per månad) beror nästan inte alls på att kvinnor och män arbetar i olika sektorer (under 1 %).`
            : `Av skillnaden i medellön för hela organisationen (${_kr(a.gapKr)} per månad) beror ${_kr(a.sektorKr)} (${_pct(a.andel * 100)}) på att kvinnor och män arbetar i olika sektorer.`);
        const dolda = alla.length - visas.length;
        if (dolda) st.push(`${_st(dolda, 'sektor', 'sektorer')} med färre än ${k} personer redovisas inte.`);
        const skr = visas.find(r => r.skrAndelKv != null);
        if (skr) st.push(`Andel kvinnor i samma sektor i ${skrDelText(skr.skrDel)} enligt SKR:s personalstatistik står som referens.`);
        return blk('Per sektor (AID-huvudområde)', st, { rubriker: ['Sektor', 'Antal', 'Andel kvinnor', 'Andel kvinnor, SKR', 'Kvinnors lön i % av mäns', 'Justerad (ålder, BAS)'],
            rader: visas.map(r => [r.namn, String(r.n), _pct(r.andelKv), r.skrAndelKv != null ? _pct(r.skrAndelKv) : '–',
                !r.samladMedian && r.kvot != null ? _pct(r.kvot) : '–',
                !r.samladMedian && r.justerat ? _pct(100 + r.justerat.pct) : '–']) });
    }
    if (typ === 'handlingsplan') {
        const rader = u.rader || [];
        const st = [`${_st(rader.length, 'förifylld åtgärd', 'förifyllda åtgärder')}` + (u.summa ? ` med en uppskattad kostnad på ${_kr(u.summa)} per år.` : '.')];
        if (!rader.length) return blk('Handlingsplan', st, null);
        return blk('Handlingsplan', st, { rubriker: ['Åtgärd', 'Grupp', 'Underlag', 'Uppskattad kostnad per år'],
            rader: rader.map(r => [r.atgard, r.grupp, r.underlag, _kr(r.kostnad)]) });
    }
    throw new Error(`Okänd avsnittstyp: ${typ}`);
}

const _esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Ren HTML för urklipp: inga typsnitt, färger eller klasser — mallen formaterar. */
export function tillWordHtml(b) {
    let h = `<h3>${_esc(b.rubrik)}</h3>`;
    for (const s of b.stycken) h += `<p>${_esc(s)}</p>`;
    if (b.tabell) {
        h += '<table border="1" cellpadding="4"><thead><tr>' + b.tabell.rubriker.map(r => `<th>${_esc(r)}</th>`).join('') + '</tr></thead><tbody>'
            + b.tabell.rader.map(r => '<tr>' + r.map(c => `<td>${_esc(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
    }
    if (b.provat) h += '<p><strong>Redan prövat</strong></p><ul>' + b.provat.map(p => `<li>${_esc(p)}</li>`).join('') + '</ul>';
    if (b.fragor) h += '<p><strong>Frågor till verksamheten</strong></p><ol>' + b.fragor.map(f => `<li>${_esc(f)}</li>`).join('') + '</ol>';
    return h;
}

/**
 * Ett block för en egen tabell ur Utforska (ADR-52): tabellen som receptet gav (receptTillTabeller), med talen
 * skrivna efter kolumnens typ, och tabellens not som stycke.
 * @param {{rubrik: string, kolumner: {rubrik: string, typ: string}[], rader: any[][], not?: string}} t
 * @param {{id: string, k?: number, urval?: string, demo?: boolean, troskelNot?: string}} val
 */
export function egenTabellBlock(t, { id, urval, demo, troskelNot }) {
    const { fore, efter } = _inled({ demo, urval, troskelNot });
    const skriv = (v, typ) => {
        if (v == null || v === '') return '–';
        if (typeof v !== 'number') return String(v);
        if (!isFinite(v)) return '–';
        return typ === 'kr' ? _kr(v) : typ === 'pct1' ? _pct(v, 1) : typ === 'antal' ? formatTal(v, 0) : formatTal(v, 2);
    };
    return { id, rubrik: t.rubrik, stycken: [...fore, ...(t.not ? [t.not] : []), ...efter], provat: null, fragor: null,
        tabell: { rubriker: t.kolumner.map(c => c.rubrik), rader: t.rader.map(r => r.map((v, j) => skriv(v, (t.kolumner[j] || {}).typ))) } };
}

/** Ren text för urklipp (reserv): tabbar mellan kolumner, numrerade frågor. */
export function tillText(b) {
    const delar = [b.rubrik, ...b.stycken];
    if (b.tabell) delar.push([b.tabell.rubriker, ...b.tabell.rader].map(r => r.join('\t')).join('\n'));
    if (b.provat) delar.push('Redan prövat:\n' + b.provat.map(p => `- ${p}`).join('\n'));
    if (b.fragor) delar.push('Frågor till verksamheten:\n' + b.fragor.map((f, i) => `${i + 1}. ${f}`).join('\n'));
    return delar.join('\n\n');
}

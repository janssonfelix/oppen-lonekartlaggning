// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — vymodellen för rapportmodellen (ADR-40, ADR-99): vilka avsnitt som följer med och i vilken
 * ordning (urvalet), och det rapportens avsnitt redovisar och utelämnar: antal och medianer per kön, BAS-intervallen
 * som får redovisas, grupperna att bedöma i Lika arbete, kandidatparen i likvärdigt arbete, översikten per
 * BAS-intervall med status, regressionens steg och BAS-effekter, intervallen och yrkesgrupperna i avsnittet per
 * BAS-intervall, de egna tabellerna och gruppdossierernas grupper. Allt som räknas, maskeras och bedöms står här, med
 * tröskeln som argument; src/app/58-rapportmodell.js skriver orden och gör delarna (stycken, tabeller, diagram).
 */
import { basEffekterForRedovisning, parForRedovisning, regStegForRedovisning } from './ktroskel.js';
import { arKvinna, arMan } from './kon.js';
import { likaArbeteGrupper } from './rapportunderlag.js';
import { direktivMarkering, perBasSignal, statusNiva } from './status.js';
import { konsMedianer, representationPerBas } from './struktur.js';
import { receptTillTabeller } from './tabellrecept.js';
import { basdossierIntervall } from './vymodell-basdossier.js';
import { oversiktNiva, oversiktPerBas } from './vymodell-lonestruktur.js';

// ---- Urvalet: vilka avsnitt som följer med, och i vilken ordning ----

/** Rapportens avsnitt i standardordning. */
export const RM_AVSNITT = Object.freeze(['sammanfattning', 'regler', 'lika', 'likvardigt', 'basintervall', 'struktur', 'referenser', 'perbas', 'atgarder', 'samverkan', 'beslut', 'regression', 'metod', 'dossierer']);
/** Avsnitt som är förvalda av: de står i listan men följer med först när de kryssas i (bilagan med gruppdossierer kan bli lång). */
export const RM_FORVALT_AV = Object.freeze(['dossierer']);
/** De färdiga urvalen. */
export const RM_URVAL = Object.freeze({
    hela: { namn: 'Hela dokumentationen', med: RM_AVSNITT.filter(id => !RM_FORVALT_AV.includes(id)) },
    ledning: { namn: 'Ledningsbrief', med: ['sammanfattning', 'lika', 'likvardigt', 'atgarder'] },
    facklig: { namn: 'Facklig dialog', med: ['sammanfattning', 'regler', 'lika', 'likvardigt', 'basintervall', 'struktur', 'referenser', 'perbas', 'samverkan', 'regression', 'metod'] },
});
/**
 * Färdiga urval som de såg ut i äldre versioner, för filer som sparades innan urvalet bar sitt id (`fast`). En fil vars
 * ordning och lista är exakt en av dessa läses som det färdiga urvalet, så att avsnitt som tillkommit följer med.
 * Läggs ett avsnitt till i RM_AVSNITT eller ett färdigt urval ändras, läggs de förra listorna till här.
 */
const RM_URVAL_TIDIGARE = Object.freeze([
    { fast: 'hela', ordning: ['sammanfattning', 'regler', 'lika', 'likvardigt', 'struktur', 'referenser', 'perbas', 'atgarder', 'samverkan', 'beslut', 'regression', 'metod'],
      med: ['sammanfattning', 'regler', 'lika', 'likvardigt', 'struktur', 'referenser', 'perbas', 'atgarder', 'samverkan', 'beslut', 'regression', 'metod'] },
    { fast: 'facklig', ordning: ['sammanfattning', 'regler', 'lika', 'likvardigt', 'struktur', 'referenser', 'perbas', 'atgarder', 'samverkan', 'beslut', 'regression', 'metod'],
      med: ['sammanfattning', 'regler', 'lika', 'likvardigt', 'struktur', 'referenser', 'perbas', 'samverkan', 'regression', 'metod'] },
    // Före bilagan med gruppdossierer (tretton avsnitt).
    { fast: 'hela', ordning: ['sammanfattning', 'regler', 'lika', 'likvardigt', 'basintervall', 'struktur', 'referenser', 'perbas', 'atgarder', 'samverkan', 'beslut', 'regression', 'metod'],
      med: ['sammanfattning', 'regler', 'lika', 'likvardigt', 'basintervall', 'struktur', 'referenser', 'perbas', 'atgarder', 'samverkan', 'beslut', 'regression', 'metod'] },
    { fast: 'facklig', ordning: ['sammanfattning', 'regler', 'lika', 'likvardigt', 'basintervall', 'struktur', 'referenser', 'perbas', 'atgarder', 'samverkan', 'beslut', 'regression', 'metod'],
      med: ['sammanfattning', 'regler', 'lika', 'likvardigt', 'basintervall', 'struktur', 'referenser', 'perbas', 'samverkan', 'regression', 'metod'] },
]);
const sammaLista = (a, b) => Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Det gällande urvalet ur det sparade (state.rapportUrval; null = hela dokumentationen): `ordning` är alla avsnitt i
 * vald ordning, `med` de som följer med, `namn` vad urvalet heter. Ett färdigt urval (`fast`) följer det urvalets
 * gällande lista, så att ett nytt avsnitt kommer med.
 * @param {any} u
 */
export function rapportUrvalAv(u) {
    if (u && u.fast && RM_URVAL[u.fast]) return { ordning: [...RM_AVSNITT], med: [...RM_URVAL[u.fast].med], namn: RM_URVAL[u.fast].namn };
    const ordning = u && Array.isArray(u.ordning) ? medNyaAvsnitt(u.ordning.filter(id => RM_AVSNITT.includes(id))) : [...RM_AVSNITT];
    const med = u && Array.isArray(u.med) ? ordning.filter(id => u.med.includes(id)) : ordning.filter(id => !RM_FORVALT_AV.includes(id));
    return { ordning, med, namn: urvalNamn(ordning, med) };
}
/**
 * Urvalets namn: alla avsnitt med heter "Alla avsnitt"; ett färdigt urval i standardordningen heter urvalet, med
 * tillägget "+ bilaga" när en förvald bilaga (RM_FORVALT_AV) som urvalet inte har är ikryssad; annars eget urval.
 * @param {string[]} ordning @param {string[]} med
 */
function urvalNamn(ordning, med) {
    if (med.length === ordning.length) return 'Alla avsnitt';
    if (sammaLista(ordning, RM_AVSNITT)) {
        const utanBilagor = med.filter(id => !RM_FORVALT_AV.includes(id));
        for (const f of Object.values(RM_URVAL)) {
            if (sammaLista(med, f.med)) return f.namn;
            if (sammaLista(utanBilagor, f.med)) return `${f.namn} + bilaga`;
        }
    }
    return `Eget urval (${med.length} av ${ordning.length} avsnitt)`;
}
/**
 * Ett avsnitt som saknas i en sparad ordning (filen sparades före avsnittet) sätts in mellan sina grannar i
 * standardordningen när de står intill varandra i den sparade ordningen; annars sist. Det följer inte med i ett sparat
 * eget urval förrän det kryssas i.
 * @param {string[]} ordning
 */
function medNyaAvsnitt(ordning) {
    const ut = [...ordning];
    RM_AVSNITT.forEach((id, i) => {
        if (ut.includes(id)) return;
        const fore = RM_AVSNITT.slice(0, i).reverse().find(x => ut.includes(x)), efter = RM_AVSNITT.slice(i + 1).find(x => ut.includes(x));
        if (fore && efter && ut.indexOf(efter) === ut.indexOf(fore) + 1) ut.splice(ut.indexOf(efter), 0, id);
        else ut.push(id);
    });
    return ut;
}
/**
 * Urvalet som det sparas (state.rapportUrval), ur ett färdigt urvals namn ('hela', 'ledning', 'facklig') eller
 * { ordning, med, fast? }. Ett urval ur en äldre fil utan `fast` som är exakt ett tidigare färdigt urval
 * (RM_URVAL_TIDIGARE) blir det urvalet; ett okänt `fast` hoppas över; okända avsnitt tas bort. null = hela.
 * @param {any} u
 */
export function rapportUrvalAttSpara(u) {
    if (u && typeof u === 'object' && !(u.fast && RM_URVAL[u.fast])) {
        const tidigare = RM_URVAL_TIDIGARE.find(t => sammaLista(u.ordning, t.ordning) && sammaLista(u.med, t.med));
        if (tidigare) u = tidigare.fast;
    }
    if (u && typeof u === 'object' && u.fast && RM_URVAL[u.fast]) u = u.fast;
    if (typeof u === 'string') u = u === 'hela' || !RM_URVAL[u] ? null : { ordning: [...RM_AVSNITT], med: [...RM_URVAL[u].med], fast: u };
    return u ? { ordning: u.ordning.filter(id => RM_AVSNITT.includes(id)), med: u.med.filter(id => RM_AVSNITT.includes(id)), ...(u.fast ? { fast: u.fast } : {}) } : null;
}

/**
 * Är modellen hela dokumentationen? Varje avsnitt som finns är med, utom de förvalda av som inte kryssats i
 * (RM_FORVALT_AV): PDF-rapportens bilagor med flikarnas tabeller följer med då.
 * @param {{avsnitt: Array<{id:string}>}} modell
 * @param {{avsnitt: Array<{id:string}>}} alla
 */
export function arHelaDokumentationen(modell, alla) {
    const med = new Set(modell.avsnitt.map(a => a.id));
    return alla.avsnitt.every(a => med.has(a.id) || RM_FORVALT_AV.includes(a.id));
}

/**
 * Avsnitten som följer med, i urvalets ordning och numrerade. Med `alla` alla avsnitt som finns, i standardordning.
 * De egna tabellerna (ADR-52) står efter avsnittet per BAS-intervall och följer med när det gör det; jämförelsen med
 * förra året (ADR-54) står efter Åtgärder och tidsplan och följer med när det gör det.
 * @param {any[]} finns  avsnitten som finns, i standardordning ({ id, rubrik, numrerad? })
 * @param {{urval: {med: string[]}, alla?: boolean, egna?: any, arsjamf?: any}} val
 */
export function rapportAvsnittIUrval(finns, { urval, alla = false, egna = null, arsjamf = null }) {
    const valda = alla ? [...finns] : urval.med.map(id => finns.find(a => a.id === id)).filter(Boolean);
    const sattEfter = (avsnitt, efter) => {
        if (!avsnitt || !(alla || urval.med.includes(efter))) return;
        const i = valda.findIndex(a => a.id === efter);
        valda.splice(i >= 0 ? i + 1 : valda.length, 0, avsnitt);
    };
    sattEfter(egna, 'perbas');
    sattEfter(arsjamf, 'atgarder');
    let nr = 0;
    return valda.map(a => ({ ...a, grundrubrik: a.rubrik, rubrik: a.numrerad ? `${++nr}. ${a.rubrik}` : a.rubrik }));
}

// ---- Avsnittens innehåll ----

/** Högst så många grupper att bedöma i Lika arbete och kandidatpar i likvärdigt arbete står i rapportens tabeller. */
export const RM_LIKA_MAX = 30, RM_PAR_MAX = 25;
/** Iakttagelsen i Regler och praxis: andelen kvinnor i det lägst betalda intervallet är mer än så många procentenheter högre. */
export const RM_IAKTTAGELSE_PE = 15;

/**
 * Vymodellen: det rapportens avsnitt redovisar och utelämnar, med tröskeln k (exportläget) och golvet för
 * statistiska skattningar. Allt som redovisas per grupp eller kön når k:
 * - `sammanfattning`: antal och medianer per kön (konsMedianer; `konOk` när båda könen når k).
 * - `representation`: BAS-intervallen som når k (`visade`, med `konLitet` när ett kön är under k), de som inte gör det
 *   (`dolda`), och `iakttagelse` (det högst och lägst betalda redovisade intervallet, när andelen kvinnor i det lägst
 *   betalda är mer än RM_IAKTTAGELSE_PE procentenheter högre).
 * - `lika`: Lika arbetes grupper med statusen Värt att granska (ADR-59), högst RM_LIKA_MAX (`overskott` de övriga), och
 *   `sma`: grupperna där ett kön är under k.
 * - `likvardigt`: kandidatparen där båda grupperna når k (parForRedovisning), högst RM_PAR_MAX; `allaParVisas` när inget
 *   par har uteslutits (först då följer kandidatparens diagram med).
 * - `oversikt`: raderna per BAS-intervall där båda könen når k, med skillnaden i kronor, status (oversiktNiva med golvet)
 *   och direktivmarkeringen.
 * - `regression`: säkerställd och minst 3 % (`kritisk`), stegen och BAS-effekterna så som de får redovisas
 *   (regStegForRedovisning, basEffekterForRedovisning) och regressionerna per BAS-intervall som skattats, med
 *   `sakerstalld` (perBasSignal 'titta'); null utan modell.
 * - `basintervall`: intervallen som når k (`kandidater`, basdossierIntervall) och de med lönerader som inte gör det.
 * - `egna`: varje recept med tabellerna ur receptTillTabeller (bara grupper som når k).
 * @param {any[]} rader
 * @param {{k:number, golv:number, bas:string[], reg?:any, lika?:any, lvPar?:any[]|null, oversikt?:any[], recept?:any[],
 *   basEffektNot?:(utelamnade:string[]) => string}} val
 *   reg: regressionen (korOLSRegression); lika: Lika arbetes grupper (likaArbeteGrupper) när appen redan räknat dem;
 *   lvPar: likvärdighetsberäkningens par; oversikt: översiktens rader per BAS-intervall (oversiktPerBas) när appen redan
 *   räknat dem; basEffektNot: noten om utelämnade BAS-effekter (appen skriver den med sina termer)
 */
export function vymodellRapport(rader, { k, golv, bas, reg = null, lika, lvPar = null, oversikt, recept = [], basEffektNot = () => '' }) {
    const rep = representationPerBas(rader, { k }) || [];
    const visade = rep.filter(g => !(g.n < k)), dolda = rep.filter(g => g.n < k).map(g => g.bas);
    /** @type {{topp:any, botten:any}|null} */
    let iakttagelse = null;
    if (visade.length >= 2) {
        const sorterade = [...visade].sort((a, b) => b.median - a.median), topp = sorterade[0], botten = sorterade[sorterade.length - 1];
        if (botten.andelKv - topp.andelKv > RM_IAKTTAGELSE_PE) iakttagelse = { topp, botten };
    }
    const likaGr = lika || likaArbeteGrupper(rader, { k, golv });
    const attBedoma = likaGr.grupper.filter(g => g.flaggad);
    const { par, utelamnade: parUtelamnade, not: parNot } = parForRedovisning(lvPar || undefined, k);
    const regOk = !!(reg && !reg.error);
    const kandidater = rader.length ? basdossierIntervall(rader, bas, k) : [];
    const kand = new Set(kandidater.map(x => x.bas));
    return {
        sammanfattning: konsMedianer(rader, { k }),
        representation: { visade, dolda, konLitet: visade.filter(g => g.konLitet).map(g => g.bas), iakttagelse },
        lika: { grupper: attBedoma.slice(0, RM_LIKA_MAX), overskott: Math.max(0, attBedoma.length - RM_LIKA_MAX),
            sma: likaGr.utelamnade.length + likaGr.grupper.filter(g => g.samladMedian).length },
        likvardigt: { par: par.slice(0, RM_PAR_MAX), antal: par.length, overskott: Math.max(0, par.length - RM_PAR_MAX), utelamnade: parUtelamnade, not: parNot,
            allaParVisas: par.length > 0 && !parUtelamnade },
        oversikt: (oversikt || oversiktPerBas(rader, bas, k)).map(o => ({ ...o, skillnadKr: Math.round(o.medKv) - Math.round(o.medMa),
            niva: oversiktNiva(o, golv), direktiv: direktivMarkering(o.gap) })),
        regression: regOk ? {
            kritisk: statusNiva(Math.abs(reg.konPct), isFinite(reg.konPctLow) && isFinite(reg.konPctHigh) ? (reg.konPctLow > 0 || reg.konPctHigh < 0) : null) === 'granska',
            steg: regStegForRedovisning(reg, k),
            basEffekter: basEffekterForRedovisning(reg, k, basEffektNot),
            perBas: (reg.perBas || []).filter(pb => pb.status === 'ok').map(pb => ({ ...pb, sakerstalld: perBasSignal(pb.gapPct, pb.pValue < 0.05, pb.pValue < 0.05).niva === 'titta' })),
        } : null,
        basintervall: { kandidater, utelamnade: bas.filter(b => !kand.has(b) && rader.some(r => r.bas === b && r.lon > 0)) },
        egna: rader.length ? recept.map(r => ({ recept: r, tabeller: receptTillTabeller(rader, r, { k }) })) : [],
    };
}

/**
 * Bilagan med gruppdossierer: av dossiergrupperna (gruppdossierGrupper) de där både kvinnor och män når k (`med`, i
 * samma ordning), och antalet där ett kön är under k (`utan`); de namnges inte.
 * @template {{rows:any[]}} G
 * @param {G[]} kandidater
 * @param {number} k
 * @returns {{med: G[], utan: number}}
 */
export function rapportDossierGrupper(kandidater, k) {
    const med = kandidater.filter(g => g.rows.filter(r => arKvinna(r)).length >= k && g.rows.filter(r => arMan(r)).length >= k);
    return { med, utan: kandidater.length - med.length };
}

/**
 * Det avsnittet Lönestruktur per BAS-intervall utelämnar, ur perBasTabeller: intervall under k (`basUtelamnade`),
 * antalet yrkesgrupper under k (`smaYrken`), intervall där ett kön är under k (`konDolda`) och intervall vars medellön
 * undertrycks i könsgap- eller åldersgruppstabellen (`medelDolda`, ADR-83).
 * @param {any} pb
 */
export function perBasUtelamnat(pb) {
    return {
        basUtelamnade: pb.basUtelamnade,
        smaYrken: pb.intervall.reduce((s, i) => s + i.utelamnade.length, 0),
        konDolda: pb.intervall.filter(i => !i.konVisas).map(i => i.bas),
        medelDolda: [...new Set([...(pb.konsgap ? pb.konsgap.undertryckta : []), ...(pb.aldersgrupper ? pb.aldersgrupper.undertryckta : [])])],
    };
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 58-rapportmodell.js — Rapportmodellen (ADR-40)
//
// Rapportens avsnitt som data: stycken, tabeller med tal som tal, diagram och fält att fylla i. Exporterna ritas ur
// modellen i stället för att var och en räkna och formulera själv.
//
// Delar: { typ: 'stycke', text, stil? } (stil: dampad | not | fet) · { typ: 'fyllIn', text } · { typ: 'rubrik', niva, text } ·
//        { typ: 'tabell', kolumner: [{ rubrik, typ }], rader: [[värde]], nyckel?, caption? } · { typ: 'diagram', id, flik, rubrik } ·
// En modelltabell, där alla rader bygger på samma urval, bär antalet i `caption` (antalText: "n = 260; …"), som skärmen.
// Kolumntyper: text, antal, ar (ålder i år), kr, krAr (kr för beräkningsperioden, periodOrd), pct0, pct1, tecken2 (procent med tecken), andelAvMan, direktiv, fyllIn.
// Ett värde kan också vara { text } (färdig text, t.ex. en förklaring i stället för ett tal) eller null (streck).
//
// Dataskydd: tröskeln tillämpas när modellen byggs — i vymodellen (src/lib/vymodell-rapport.js, ADR-99), med samma
// funktioner som vyerna och rapportunderlaget; här skrivs orden och delarna. Den som ritar formaterar bara. Varje
// avsnitt säger i `utelamnat` vad det inte redovisar; det är underlaget till exporternas förhandsbesked.
// ====================================================================
import { utanTaggar } from '../lib/htmltext.js';
import { matchningEtikett } from '../lib/jamforelse.js';
import { periodOrd } from '../lib/kostnad.js';
import { kvinnorOchMan, personOrd } from '../lib/namn.js';
import { perBasTabeller } from '../lib/perbas.js';
import { bortvaltNotering, gruppMedBas, skalSammanstallningNot } from '../lib/rapportunderlag.js';
import { STATUS_NOT, stegEtikett } from '../lib/regression.js';
import { direktivMarkering } from '../lib/status.js';
import { tillDirektivtecken } from '../lib/struktur.js';
import { svKr, svPct, svTal, svTecken } from '../lib/talformat.js';
import { adjektiv, artikel, genitiv, ordForAntal, stor, termFras } from '../lib/termer.js';
import { perBasUtelamnat, rapportAvsnittIUrval, rapportDossierGrupper, rapportUrvalAttSpara, rapportUrvalAv, RM_LIKA_MAX, RM_PAR_MAX, vymodellRapport } from '../lib/vymodell-rapport.js';
import { esc } from './01-html-och-tillganglighet.js';
import { andelAvMan, ANSVARSFORBEHALL, antalText, rapporteraFel } from './03-hjalpfunktioner.js';
import { AID_METODTEXT } from './04-ordlista.js';
import { _basEffektNot, _konUtelamnatNot, _kSanktNot, _raGapText, kInstalld, kTroskel, statGolv } from './06-k-troskel.js';
import { kMaskNot, kSamladNot } from './06-maskeringsnoter.js';
import { orgNamn } from './07-standardinstallningar.js';
import { APP_VERSION } from './08-version.js';
import { T, termText } from './09-termer.js';
import { _STS_DIR_ETIKETT, _STS_DIR_KOLUMN, _STS_DIR_TIPS, gapStatusNiva } from './10-diagramtema.js';
import { diagramRitat, diagramTillBild } from './11-diagramexport.js';
import { hamtaBasIntervall, hamtaData, policyFor, referensKalla, referensKortnamn, referensNamn, state, statistikBeskrivning } from './12-tillstand.js';
import { bedomningUnderlag, bootstrapKIGallande, styrkaGallande, UK_ETIKETT } from './13-oversikt.js';
import { _metodbilaga, EU_LONEBEGREPP_RESERVATION, RATTSLIG_RAM } from './22-exporthjalpare.js';
import { medExportLage } from './23-exportgrind.js';
import { ritaFlik } from './31-navigering.js';
import { likvardighetResultat } from './34-likvardigt-arbete.js';
import { _laOversiktRader, _laTrattGlesNot, laLikaGrupper } from './41-lika-arbete.js';
import { referensOverblick } from './44-referensoverblick.js';
import { konsklassOrd, lvJamforelse } from './45-aid-bas-tabeller.js';
import { _RG_STEG_YRKE, ALDER_METODVAL_TEXT, ALDER_SAKNAS_TEXT, harAlder } from './50-regressionsmodeller.js';
import { _formateraPVarde, _yrkesStegText, korOLSRegression } from './51-lika-arbete-regressionskort.js';
import { _handlingsplanForifyllning, _hpKostnadAvser, _hpSkalUnderlag, HP_SKAL_UTAN_BELOPP } from './56-handlingsplan.js';
import { _bes8Omraden } from './61-regler-och-praxis.js';
import { _abForandringText, _abGruppAntal, _abKr, _abSpridningText, AB_SPRIDNING_NOT, abGrupperEjJamforbara, arsjamforelse } from './73-arsbokslut.js';
import { byggGruppdossier, gruppdossierSomText, gruppdossierDelat } from './80-gruppdossier.js';
import { basdossierStycken, basdossierYrkesrader, BD_BEDOMNING, BD_YRKESKOLUMNER, byggBasdossier } from './81-basdossier.js';

/** Avsnittet om lönetransparens (EU 2023/970) har direktivets tecken (art. 9): (män − kvinnor) / män, positivt när
 *  kvinnor ligger lägre, med tecknet utskrivet. Samma tal som i EU-lönerapportens blad. */
function rmDirektivGap(gapPct, dec = 1) { const v = tillDirektivtecken(gapPct); return v == null ? '—' : `${v > 0 ? '+' : ''}${svPct(v, dec)}`; }
const RM_DIREKTIV_RUBRIK = 'Löneskillnad enligt direktivet';
// Regressionens råa kvot räknas på modellens urval, som kan vara mindre än sammanfattningens (rader utan ålder):
// etiketten säger det, så att samma etikett aldrig står med två tal i ett dokument.
const _raGapEtikett = reg => `Kvinnors medianlön i procent av mäns, i modellens urval (n = ${reg.nKvAnalysed + reg.nMaAnalysed})`;

/** Ett värde i en tabellcell som text, efter kolumnens typ. */
function rmCell(v, typ) {
    if (v && typeof v === 'object') return v.text == null ? '' : String(v.text);
    if (typ === 'fyllIn') return v == null || v === '' ? '' : String(v);
    if (v == null || v === '') return '—';
    if (typ === 'text') return String(v);
    if (typeof v !== 'number' || !isFinite(v)) return String(v);
    if (typ === 'antal') return svTal(v, 0);
    if (typ === 'ar') return `${svTal(v, 0)} år`;
    if (typ === 'tal2') return svTal(v, 2);
    if (typ === 'kr') return svKr(v);
    if (typ === 'krAr') return `${svTal(v, 0)}\u00a0kr/${periodOrd(state.costSettings)}`;
    if (typ === 'pct0') return svPct(v, 0);
    if (typ === 'pct1') return svPct(v, 1);
    if (typ === 'tecken2') return `${v >= 0 ? '+' : ''}${svPct(v, 2)}`;
    if (typ === 'andelAvMan') return andelAvMan(v);
    if (typ === 'direktiv') return rmDirektivGap(v);
    return String(v);
}

// Texten ur en not som vyerna bygger som HTML (kMaskNot, kSamladNot): namnen är redan escapade där.
function _rmNotText(html) {
    if (!html) return '';
    const d = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    return d.body.textContent.replace(/\s+/g, ' ').trim();
}

// Diagram som följer med i rapporten: id på diagrammet, fliken som ritar det och avsnittet det hör till (och `del`,
// när diagrammet står vid en viss tabell i avsnittet i stället för där avsnittet tar sina diagram).
// Ett diagram som inte ritas — för att underlaget inte når tröskeln — följer inte med.
const RM_DIAGRAM = [
    { id: 'chart-skevhet-overview', flik: 'struktur', avsnitt: 'struktur', rubrik: `Kvinnors medianlön i procent av mäns, per ${T.niva.en} — samma kvot och intervall som tabellen ovan` },
    { id: 'chart-skevhet-andel', flik: 'struktur', avsnitt: 'struktur', rubrik: `Könsfördelning per ${T.niva.en}` },
    { id: 'chart-struktur-kvartiler', flik: 'struktur', avsnitt: 'struktur', rubrik: 'Kvinnor och män per lönekvartil' },
    { id: 'chart-struktur-tradkarta', flik: 'struktur', avsnitt: 'struktur', rubrik: `Organisationen som karta — en yta per ${T.enhet.en}, storleken är antalet personer och färgen andelen kvinnor` },
    { id: 'chart-perbas-gap', flik: 'struktur', avsnitt: 'lika', rubrik: `Oförklarad löneskillnad per ${T.niva.en}` },
    { id: 'chart-la-tratt', flik: 'matrix', avsnitt: 'lika', rubrik: `${stor(T.enhet.bfl)} mot slumpens gränser — kvinnors medianlön i procent av mäns mot gruppens storlek`,
      // Samma förbehåll som under diagrammet på skärmen, räknat ur den ritade figuren.
      metodNot: () => { const f = /** @type {any} */ (document.getElementById('chart-la-tratt'))?._figur;
          return f ? _laTrattGlesNot(f.lager.filter(l => l.marke === 'punkt').reduce((n, l) => n + l.data.length, 0)) : null; } },
    // Ålder & karriär följer flikens eget val av BAS-intervall: bilden tas bara med när fliken visar hela urvalet,
    // så att rapporten aldrig bär ett diagram för ett enda intervall under en rubrik som gäller alla.
    { id: 'chart-kon-aldergap', flik: 'kon', avsnitt: 'struktur', rubrik: `Löneskillnad per åldersgrupp — rå skillnad, alla ${T.enhet.fl} och ${T.niva.fl}`,
      om: () => { const v = /** @type {HTMLInputElement} */ ((document.getElementById('bas-select-kon') || {})).value; return harAlder() && (!v || v === '__ALLA__'); } },
    { id: 'chart-lp-konlagen', flik: 'benchmark', avsnitt: 'struktur', rubrik: 'Var i referensens lönespann ligger kvinnor och män' },
    { id: 'chart-ref-hantel', flik: 'benchmark', avsnitt: 'referenser', rubrik: `Löneläget och statistiken mot ställningstagandet per ${T.enhet.en} — bandet P10–P90, strecket medianen`,
      om: () => !!(state.policy.length || state.statistik.length) },
    { id: 'chart-likvardighet-heatmap', flik: 'likvardighet', avsnitt: 'likvardigt', rubrik: 'Kandidatpar i likvärdigt arbete', kraverAllaPar: true },
    // Jämförelsen med förra året (ADR-54) ritas av fliken Spara och jämför år, bara när ett bokslut är inläst.
    { id: 'chart-arsjamforelse', flik: 'arbetet', avsnitt: 'arsjamforelse', rubrik: `Kvinnors medianlön i procent av mäns per ${T.enhet.en}, förra året (strecket) och i år (punkten)`,
      om: () => !!state.forraArsbokslut },
    // Hanteln per BAS-intervall står under tabellen Löneutveckling per BAS-intervall (del: 'bas'), bara när förra
    // årets bokslut har raderna per intervall (ett äldre bokslut saknar dem).
    { id: 'chart-arsjamforelse-bas', flik: 'arbetet', avsnitt: 'arsjamforelse', del: 'bas', rubrik: `Medianlön per ${T.niva.en}, förra året (strecket) och i år (punkten)`,
      om: () => !!(state.forraArsbokslut && Array.isArray(state.forraArsbokslut.basIntervall)) },
];

// ---- Urval: vilka avsnitt som följer med, och i vilken ordning ----
// Urvalet ligger i minnet (state.rapportUrval) och följer med i konfigurationsfilen. null = hela dokumentationen.
// Reglerna (de färdiga urvalen, äldre filers urval, namnet och ordningen) står i src/lib/vymodell-rapport.js.
/** Det gällande urvalet: `ordning` är alla avsnitt i vald ordning, `med` de som följer med, `namn` vad urvalet heter. */
export function rapportUrval() { return rapportUrvalAv(state.rapportUrval); }
/** Sätter urvalet: ett färdigt urvals namn ('hela', 'ledning', 'facklig') eller { ordning, med, fast? } (rapportUrvalAttSpara). */
export function sattRapportUrval(u) { state.rapportUrval = rapportUrvalAttSpara(u); }

/**
 * Handlingsplanens sakliga skäl i rapporten: tabellen Sakliga skäl per grupp (en rad per skäl, gruppen på första
 * raden) och Sammanställning per kategori, med en dämpad mening om att kategorierna och beloppen är organisationens bedömning. Inget
 * när ingen rad har skäl. `skal` ur _hpSkalUnderlag (raderna är redan k-grindade av förifyllningen).
 */
function rmSakligaSkalDelar(skal, dampad) {
    if (!skal || !skal.grupper.length) return [];
    const tom = { text: '' };
    // En grupp där ett kön är under minsta gruppstorlek: bara kategorin, med noten i kommentarens kolumn.
    const rader = skal.grupper.flatMap(g => g.sammanstallning.skal.map((s, i) => [
        i ? tom : g.grupp, i ? tom : (g.antal != null ? g.antal : tom), i ? tom : g.skillnadKr,
        s.namn, g.utanBelopp ? tom : s.belopp, g.utanBelopp || s.andel == null ? null : s.andel * 100,
        g.utanBelopp ? { text: HP_SKAL_UTAN_BELOPP } : s.kommentar ? s.kommentar : tom]));
    const pk = skal.perKategori;
    const kat = pk.kategorier.map(k => [k.namn, k.summa, k.andel != null ? k.andel * 100 : null, k.antalGrupper]);
    const over = skal.grupper.filter(g => g.sammanstallning.overstiger);
    const kr = v => svKr(v);
    return [
        { typ: 'rubrik', niva: 3, text: 'Sakliga skäl per grupp' },
        { typ: 'tabell', kolumner: [{ rubrik: 'Grupp', typ: 'text' }, { rubrik: 'Antal berörda', typ: 'antal' }, { rubrik: 'Medianskillnad (kr/mån)', typ: 'kr' }, { rubrik: 'Kategori', typ: 'text' },
            { rubrik: 'Belopp (kr/mån)', typ: 'kr' }, { rubrik: 'Andel av skillnaden', typ: 'pct0' }, { rubrik: 'Kommentar', typ: 'text' }], rader },
        ...(over.length ? [dampad(over.map(g => `${g.grupp}: skälen är tillsammans större än skillnaden (${kr(g.sammanstallning.summa)} mot ${kr(g.skillnadKr)}).`).join(' ')
            + ` Ett belopp kan vara för högt, eller så räknar två skäl samma sak. Kontrollera beloppen.`)] : []),
        { typ: 'rubrik', niva: 3, text: 'Sammanställning per kategori' },
        { typ: 'tabell', kolumner: [{ rubrik: 'Kategori', typ: 'text' }, { rubrik: 'Belopp (kr/mån)', typ: 'kr' }, { rubrik: 'Andel av skillnaden i grupper med skäl', typ: 'pct0' }, { rubrik: 'Antal grupper', typ: 'antal' }],
          rader: [...kat, [{ text: 'Totalt', fet: true }, pk.summa, pk.andel != null ? pk.andel * 100 : null, pk.antalGrupper]] },
        dampad(`Kategorierna och beloppen är organisationens bedömning. Verktyget räknar bara om beloppen till andelar av skillnaden. Skillnaden är gruppens medianskillnad i kronor per månad. För en grupp ur prioriteringen är det mäns median minus kvinnors. För ett kandidatpar är det ${genitiv(T.jamforelse.bf)} median minus ${termFras(T.enhet, 'bf', { adjektiv: 'kvinnodominerad', genitiv: true })}. ` + skalSammanstallningNot(kInstalld())),
    ];
}

/** Måtten i tabellerna per BAS-intervall, med rubrikerna i Word-utkastet och Excel-filen. */
export const RM_MATT = Object.freeze({ p10: 'P10', p25: 'P25', med: 'Median', p75: 'P75', p90: 'P90', medel: 'Medellön' });

/**
 * Underlaget till avsnittet Lönestruktur per BAS-intervall: samma tre tabeller i Word-utkastet och Excel-filen.
 * @param {any[]} d
 * @param {number} k
 */
export function rmPerBasUnderlag(d, k) {
    if (!d.length) return null;
    return perBasTabeller(d, { k, referens: (aid, bas) => policyFor(aid, bas), statistik: state.statistik, recept: state.perBasRecept,
        referensNamn: referensKortnamn(), statistikNamn: state.statistik.length ? (state.statistikNamn || 'Jämförelsestatistik') : 'Jämförelsestatistik' });
}

/**
 * Noterna om kompletterande undertryckning (ADR-83) i avsnittet per BAS-intervall: vilka medelvärden som inte
 * redovisas och varför. Samma text i Word, PDF och Excel; vilka grupper det gäller kommer ur src/lib/perbas.js.
 * @param {any} pb resultatet från rmPerBasUnderlag
 * @param {number} k
 */
export function rmPerBasUndertryckNoter(pb, k) {
    const kort = pb.dim === 'sektor' ? T.huvudomrade.en : 'BAS';
    const medel = pb.harAlder !== false ? 'Medellön och medelålder' : 'Medellön';
    const grupp = `Annars skulle medellönen för en grupp med färre än ${k} ${personOrd(k)} gå att räkna fram`;
    const kon = `Annars skulle medellönen för färre än ${k} kvinnor eller män gå att räkna fram`;
    const kg = pb.konsgap, ag = pb.aldersgrupper;
    return {
        konsgap: kg ? [
            ...(kg.undertryckta.length ? [`${medel} redovisas inte för ${kort} ${kg.undertryckta.join(', ')}. ${grupp} ur raden Alla.`] : []),
            ...(kg.konUndertryckta.length ? [`${medel} för kvinnor och män redovisas inte för ${kort} ${kg.konUndertryckta.join(', ')}. ${kon} ur raden Alla.`] : [])] : [],
        aldersgrupper: ag && ag.undertryckta.length ? [`Medelålder och medellön redovisas inte för ${kort} ${ag.undertryckta.join(', ')}. ${grupp} ur raden Alla.`] : [],
        /** @param {any} i ett intervall ur pb.intervall */
        intervall: i => [
            ...(i.medelUndertryckt ? [`Medellönen redovisas inte i tabellen. ${grupp} ur raden Alla längre ned.`] : []),
            ...(i.undertryckta.length ? [`Medellönen redovisas inte för ${i.undertryckta.join(', ')}. ${grupp} ur organisationens rad.`] : []),
            ...(i.konMedelUndertryckt ? [`Medellönen för kvinnor och män redovisas inte i tabellen. ${kon} ur raden Alla längre ned.`] : [])],
    };
}

/**
 * Avsnittet Lönestruktur per BAS-intervall, i den form en skriven lönekartläggning brukar ha: en tabell per
 * BAS-intervall (referens, organisationen, yrkesgrupperna med jämförelsestatistikens rad under, kvinnor och män),
 * ett fält för bedömningen av intervallet, och sist två tabeller per BAS: löneskillnader inom likvärdigt arbete
 * (medellön per kön, andel kvinnor, medelålder) och löneskillnader i åldersgrupper. Tröskeln tillämpas i
 * src/lib/perbas.js; avsnittet säger i `utelamnat` vad det inte redovisar.
 * @param {any[]} d
 * @param {number} k
 */
function rmPerBasAvsnitt(d, k) {
    const pb = rmPerBasUnderlag(d, k);
    if (!pb || !pb.intervall.length) return null;
    const stycke = (text, stil) => ({ typ: 'stycke', text, ...(stil ? { stil } : {}) });
    const matt = pb.recept.matt;
    const kol = [{ rubrik: 'Grupp', typ: 'text' }, { rubrik: 'Antal', typ: 'antal' }, ...matt.map(m => ({ rubrik: RM_MATT[m], typ: 'kr' }))];
    const dimEtikett = pb.dimEtikett, kort = pb.dim === 'sektor' ? T.huvudomrade.en : 'BAS', per = pb.dim === 'sektor' ? T.huvudomrade.en : T.niva.en;
    const utelamnat = [];
    const { basUtelamnade, smaYrken, konDolda, medelDolda } = perBasUtelamnat(pb);
    if (basUtelamnade.length) utelamnat.push(`BAS ${basUtelamnade.join(', ')} (färre än ${k} ${personOrd(k)})`);
    if (smaYrken) utelamnat.push(`${smaYrken} ${ordForAntal(smaYrken, T.enhet)} med färre än ${k} ${personOrd(k)}`);
    if (konDolda.length) utelamnat.push(`könsuppdelade lönemått för BAS ${konDolda.join(', ')} (ett kön har färre än ${k} ${personOrd(k)})`);
    const undertryckNoter = rmPerBasUndertryckNoter(pb, k);
    if (medelDolda.length) utelamnat.push(`medellön för ${kort} ${medelDolda.join(', ')} (så att en grupp med färre än ${k} ${personOrd(k)} inte kan räknas fram)`);
    /** @type {any[]} */
    const delar = [
        stycke(pb.dim === 'sektor'
            ? `Löneläget i varje ${T.huvudomrade.en}: organisationen, de ${T.enhet.fl} som når minsta gruppstorlek, och kvinnor och män. P10 och P90 är den tionde och nittionde percentilen.`
            : `Löneläget i varje ${T.niva.en} mot ${referensKortnamn()}: organisationen, de ${T.enhet.fl} som når minsta gruppstorlek (med jämförelsestatistikens nivå under, när den finns) och kvinnor och män. P10 och P90 är den tionde och nittionde percentilen.`, 'dampad'),
    ];
    for (const i of pb.intervall) {
        delar.push({ typ: 'rubrik', niva: 3, text: `${dimEtikett} ${i.bas}` });   // "BAS-intervall D" / "Huvudområde Vård"
        delar.push(stycke(`${i.n} ${i.n === 1 ? 'anställd' : 'anställda'} i ${i.antalYrken} ${ordForAntal(i.antalYrken, T.enhet)}, varav ${kvinnorOchMan(i.nKv, i.nMa, ' och ')}.`));
        delar.push({ typ: 'tabell', kolumner: kol, rader: i.rader.map(r => [r.namn, r.n, ...matt.map(m => r[m] ?? null)]) });
        const noter = [];
        if (i.utelamnade.length) noter.push(`${i.utelamnade.length} ${ordForAntal(i.utelamnade.length, T.enhet)} med färre än ${k} ${personOrd(k)} redovisas inte: ${i.utelamnade.join(', ')}.`);
        if (!i.konVisas) noter.push(`Kvinnor och män redovisas inte var för sig eftersom ett kön har färre än ${k} ${personOrd(k)} i intervallet.`);
        noter.push(...undertryckNoter.intervall(i));
        if (noter.length) delar.push(stycke(noter.join(' '), 'not'));
        delar.push({ typ: 'fyllIn', text: `Bedömning av ${kort} ${i.bas}: löneläget mot referensen och jämförelsestatistiken, de största ${T.enhet.bfl}, och om skillnaderna mellan kvinnor och män har sakliga skäl.` });
    }
    if (pb.konsgap) {
        // Utan ålder i lönefilen (ADR-64) står medelåldern inte med.
        const medAlder = pb.harAlder !== false;
        delar.push({ typ: 'rubrik', niva: 3, text: `Löneskillnader inom likvärdigt arbete, per ${per}` });
        delar.push(stycke(`Medellön för alla, män och kvinnor i varje ${T.niva.en}, kvinnors medellön i procent av mäns${medAlder ? ', andel kvinnor och medelålder' : ' och andel kvinnor'}. Könsuppdelade mått visas bara där båda könen når minsta gruppstorlek.`, 'dampad'));
        delar.push({ typ: 'tabell', kolumner: [{ rubrik: 'BAS', typ: 'text' }, { rubrik: 'Antal', typ: 'antal' }, { rubrik: 'Medellön alla', typ: 'kr' }, { rubrik: 'Medellön män', typ: 'kr' }, { rubrik: 'Medellön kvinnor', typ: 'kr' },
            { rubrik: 'Kvinnors medellön i % av mäns', typ: 'pct1' }, { rubrik: 'Andel kvinnor', typ: 'pct1' },
            ...(medAlder ? [{ rubrik: 'Medelålder alla', typ: 'ar' }, { rubrik: 'Medelålder män', typ: 'ar' }, { rubrik: 'Medelålder kvinnor', typ: 'ar' }] : [])],
            rader: pb.konsgap.rader.map(r => [r.bas, r.n, r.medel, r.medelMa, r.medelKv, r.kvot, r.andelKv, ...(medAlder ? [r.alder, r.alderMa, r.alderKv] : [])]) });
        if (undertryckNoter.konsgap.length) delar.push(stycke(undertryckNoter.konsgap.join(' '), 'not'));
    }
    if (pb.recept.aldersgrupper && pb.harAlder === false) {
        delar.push(stycke('Löneskillnader i åldersgrupper redovisas inte: lönefilen saknar ålder.', 'not'));
        utelamnat.push('löneskillnader i åldersgrupper (lönefilen saknar ålder)');
    }
    if (pb.aldersgrupper) {
        delar.push({ typ: 'rubrik', niva: 3, text: `Löneskillnader i åldersgrupper, per ${per}` });
        delar.push(stycke(`Medellön i åldersgrupperna ${pb.aldersgrupper.grupper.join(', ')} år. En åldersgrupp med färre än ${k} ${personOrd(k)} i intervallet får ingen medellön.`, 'dampad'));
        delar.push({ typ: 'tabell', kolumner: [{ rubrik: 'BAS', typ: 'text' }, { rubrik: 'Antal', typ: 'antal' }, { rubrik: 'Medelålder', typ: 'ar' }, { rubrik: 'Medellön alla', typ: 'kr' },
            ...pb.aldersgrupper.grupper.map(g => ({ rubrik: `Medellön ${g} år`, typ: 'kr' }))],
            rader: pb.aldersgrupper.rader.map(r => [r.bas, r.n, r.alder, r.medel, ...r.perGrupp]) });
        if (undertryckNoter.aldersgrupper.length) delar.push(stycke(undertryckNoter.aldersgrupper.join(' '), 'not'));
        delar.push({ typ: 'fyllIn', text: 'Bedömning: hur lönen utvecklas med åldern i organisationen, och om löneutvecklingen för äldre anställda avstannar.' });
    }
    return { id: 'perbas', numrerad: true, rubrik: `Lönestruktur per ${per}`, utelamnat, delar };
}

/**
 * Avsnittet Lönekartläggning per BAS-intervall: en underrubrik per intervall som når k, med BAS-dossierns stycken
 * (basdossierStycken i 81-basdossier.js, samma text som dossierns kopia och rapportutkastet), intervallets
 * yrkesgruppstabell (bara yrken där båda könen når k) och ett fält för bedömningen. Byggs i exportläget som resten
 * av modellen: intervall och yrkesgrupper under k står inte med lönemått.
 * @param {number} k
 * @param {{kandidater: Array<{bas:string}>, utelamnade: string[]}} bi  intervallen ur vymodellen (vymodellRapport)
 */
function rmBasintervallAvsnitt(k, bi) {
    const kand = bi.kandidater;
    if (!kand.length) return null;
    const stycke = (text, stil) => ({ typ: 'stycke', text, ...(stil ? { stil } : {}) });
    const under = bi.utelamnade;
    const utelamnat = under.length ? [`BAS ${under.join(', ')} (färre än ${k} ${personOrd(k)})`] : [];
    /** @type {any[]} */
    const delar = [stycke(`Ett avsnitt per ${T.niva.en} med minst ${k} ${personOrd(k)}, i samma ordning som rapporten i övrigt: antal och könsfördelning, ${state.policy.length ? 'läget mot ställningstagandet, ' : ''}${T.enhet.bfl} med status enligt Lika arbete, likvärdigt arbete${harAlder() ? ', ålder' : ''} och förra året när ett bokslut är inläst. Tabellen har ${T.enhet.bfl} där både kvinnor och män når minsta gruppstorlek.`, 'dampad')];
    let smaYrken = 0;
    for (const { bas } of kand) {
        const d = byggBasdossier(bas);
        if (!d) continue;
        smaYrken += d.yrkenUtelamnade.length;
        delar.push({ typ: 'rubrik', niva: 3, text: `${stor(T.niva.en)} ${d.bas}` });
        for (const s of basdossierStycken(d, { forraBaraMedBokslut: true })) delar.push(stycke(s.rubrik, 'fet'), ...s.rader.map(r => stycke(r)));
        const rader = basdossierYrkesrader(d);
        if (rader.length) delar.push({ typ: 'tabell', kolumner: BD_YRKESKOLUMNER.map((rubrik, i) => ({ rubrik, typ: ['text', 'text', 'text', 'kr', 'kr', 'pct1', 'text'][i] })),
            rader: rader.map(r => [r.aid, r.yrke, `${r.nKv} / ${r.nMa}`, r.medKv, r.medMa, r.kvotPct, r.status]) });
        delar.push({ typ: 'fyllIn', text: BD_BEDOMNING });
    }
    if (smaYrken) utelamnat.push(`lönemått för ${smaYrken} ${ordForAntal(smaYrken, T.enhet)} i intervallen med färre än ${k} ${personOrd(k)}`);
    return { id: 'basintervall', numrerad: true, rubrik: `Lönekartläggning per ${T.niva.en}`, utelamnat, delar };
}

/**
 * Avsnittet Jämförelse med förra året (ADR-54): nyckeltalen sida vid sida, flaggade yrkesgrupper som kvar, nya och
 * borta, hanteln och Att göra. Finns bara när ett bokslut är inläst; står efter Åtgärder och tidsplan.
 * @param {(avsnitt: string, del?: string) => any[]} diagram
 */
function rmArsjamforelseAvsnitt(diagram) {
    const jf = arsjamforelse();
    if (!jf) return null;
    const { forra, nu, j } = jf;
    if (!j) return null;
    const stycke = (text, stil) => ({ typ: 'stycke', text, ...(stil ? { stil } : {}) });
    const skriv = (v, typ) => (v == null ? '—' : typ === 'kr' ? svKr(v) : typ === 'pct' ? svPct(v, 1) : svTal(v, 0));
    const diff = (v, typ) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${typ === 'pct' ? `${svTal(Math.abs(v), 1)} procentenheter` : skriv(Math.abs(v), typ)}`);
    const text = s => ({ text: s });
    /** @type {any[]} */ const delar = [
        stycke(`Jämfört med lönekartläggningen ${forra.ar} (bokslut sparat ${forra.skapat}, minsta gruppstorlek ${forra.k}). Lönemått bara för ${T.enhet.fl} där båda könen når minsta gruppstorlek; skillnaden är kvinnors medianlön mot mäns, negativ när kvinnor ligger lägre.`, 'dampad'),
        { typ: 'tabell', kolumner: [{ rubrik: 'Mått', typ: 'text' }, { rubrik: String(forra.ar), typ: 'text' }, { rubrik: String(nu.ar), typ: 'text' }, { rubrik: 'Skillnad', typ: 'text' }],
          rader: j.nyckeltal.map(r => [r.etikett, text(skriv(r.forra, r.typ)), text(skriv(r.nu, r.typ)), text(diff(r.diff, r.typ))]) },
    ];
    const grupptabell = (rubrik, lista, tom) => {
        if (!lista.length) { delar.push(stycke(`${rubrik}: ${tom}`)); return; }
        delar.push(stycke(`${rubrik} (${lista.length}):`));
        delar.push({ typ: 'tabell', kolumner: [{ rubrik: stor(T.enhet.en), typ: 'text' }, { rubrik: `Kvinnor / män ${nu.ar}`, typ: 'text' }, { rubrik: `Skillnad ${forra.ar}`, typ: 'pct1' }, { rubrik: `Skillnad ${nu.ar}`, typ: 'pct1' }],
            rader: lista.map(g => [gruppMedBas(g), _abGruppAntal(g, nu.ar), g.gapForra, g.gapNu]) });
    };
    delar.push(...rmBasUtvecklingDelar(j, forra.ar, nu.ar, diagram('arsjamforelse', 'bas')));
    delar.push({ typ: 'rubrik', niva: 3, text: 'Lika arbete' });
    if (j.grupper.ejJamforbara) delar.push(stycke(abGrupperEjJamforbara()));
    else {
        grupptabell('Flaggade båda åren', j.grupper.kvar, `${adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.enhet)} ${T.enhet.en}.`);
        grupptabell('Nya flaggade', j.grupper.nya, 'inga.');
        grupptabell('Inte längre flaggade', j.grupper.borta, 'ingen.');
    }
    delar.push(...diagram('arsjamforelse'));
    const p = j.punkter;
    delar.push({ typ: 'rubrik', niva: 3, text: 'Att göra' });
    delar.push(stycke(`${forra.ar} var ${p.klaraForra} av ${p.totaltForra} punkter avbockade; ${nu.ar} ${p.klaraNu} av ${p.totaltNu}.`));
    if (p.kvarFranForra.length) {
        delar.push({ typ: 'tabell', kolumner: [{ rubrik: `Öppna punkter ${forra.ar}`, typ: 'text' }, { rubrik: 'Läge i år', typ: 'text' }],
            rader: p.kvarFranForra.map(q => [q.titel || q.id, q.klarNu ? 'klar' : q.finnsNu ? 'fortfarande öppen' : 'finns inte längre i listan']) });
    } else delar.push(stycke(`${forra.ar} hade inga öppna punkter.`));
    const utelamnat = j.samma_k ? [] : [`bokslutet sparades med minsta gruppstorlek ${forra.k}, i år gäller ${nu.k}: ${T.enhet.fl} och ${T.niva.fl} jämförs bara där de, och för könsuppdelade mått båda könen, når den högre av årens gränser, ${j.kGrans} ${personOrd(j.kGrans)}`];
    return { id: 'arsjamforelse', numrerad: true, rubrik: 'Jämförelse med förra året', utelamnat, delar };
}

/**
 * Bilaga: gruppdossierer. En dossier per yrkesgrupp (AID inom BAS) där båda könen når k, i gruppdossierns ordning
 * (störst först), med samma text som gruppdossierns kopia (gruppdossierSomText): första raden som rubrik, resten som
 * stycken. Byggs i exportläget, som hela modellen. AID-etiketter där ett kön är under k räknas, de namnges inte. BAS-
 * intervallens dossierer står redan i avsnittet Lönekartläggning per BAS-intervall och upprepas inte här.
 * @param {number} k
 * @param {{ stub?: boolean, besked?: boolean }} [val] stub: bara rubriken (listan över alla avsnitt behöver inte innehållet);
 *   besked: rubriken och det utelämnade, utan texterna (förhandsbeskedet)
 */
function rmDossierAvsnitt(k, { stub = false, besked = false } = {}) {
    const avsnitt = { id: 'dossierer', rubrik: 'Bilaga: gruppdossierer', utelamnat: /** @type {string[]} */ ([]), delar: /** @type {any[]} */ ([]) };
    if (stub) return avsnitt;
    // Vilka grupper som kommer med avgörs av antalet kvinnor och män (rapportDossierGrupper); dossiererna byggs bara för
    // dem, och de delade underlagen (kandidaterna, gapet per BAS, prioriteringen) räknas en gång.
    const delat = gruppdossierDelat({ text: true });
    const { med: medGrupper, utan } = rapportDossierGrupper(delat.kandidater, k);
    if (utan) avsnitt.utelamnat.push(`gruppdossiern för ${utan} ${ordForAntal(utan, T.enhet)} där ett kön har färre än ${k} ${personOrd(k)}`);
    // Förhandsbeskedet behöver bara antalet och det utelämnade, inte texterna.
    if (besked) return avsnitt;
    const dossierer = /** @type {any[]} */ (medGrupper.map(g => byggGruppdossier(g.key, delat)).filter(Boolean));
    avsnitt.delar.push({ typ: 'stycke', stil: 'dampad', text: `En dossier per ${T.enhet.en} i ${T.niva.en} där både kvinnor och män är minst ${k}, störst först — samma text som gruppdossierns kopia.${rapportUrval().med.includes('basintervall') ? ` ${stor(T.niva.bfl)} står i avsnittet Lönekartläggning per ${T.niva.en}.` : ''}` });
    // Meningen om sänkt tröskel en gång för hela bilagan, inte en gång per dossier.
    if (_kSanktNot()) avsnitt.delar.push({ typ: 'stycke', text: _kSanktNot() });
    for (const d of dossierer) {
        const rader = gruppdossierSomText(d, { stampel: false }).split('\n');
        avsnitt.delar.push({ typ: 'rubrik', niva: 3, text: rader[0] });
        for (const r of rader.slice(1)) if (r.trim()) avsnitt.delar.push({ typ: 'stycke', text: r.trim() });
    }
    if (!dossierer.length) avsnitt.delar.push({ typ: 'stycke', stil: 'dampad', text: `${stor(adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.enhet))} ${T.enhet.en} har minst ${k} kvinnor och ${k} män.` });
    return avsnitt;
}

/**
 * Löneutvecklingen per BAS-intervall i avsnittet Jämförelse med förra året: en tabell med antal och P10, median och
 * P90 som "förra året till i år (förändring)", en kolumn per mått så att tabellen ryms på en stående sida. Bara när
 * båda åren har fältet; ett äldre bokslut utan det ger ingenting här (panelen säger att det saknas i filen).
 * Tröskeln är redan tillämpad i bokslutet (src/lib/arsbokslut.js) och i årets bokslut, som byggs i exportläget.
 */
function rmBasUtvecklingDelar(j, forraAr, nuAr, bilder = []) {
    if (!j || !Array.isArray(j.basIntervall) || !j.basIntervall.length) return [];
    const antal = f => (f.forra == null && f.nu == null ? null : `${f.forra == null ? '–' : svTal(f.forra, 0)} till ${f.nu == null ? '–' : svTal(f.nu, 0)}`);
    const matt = f => (f.forra == null && f.nu == null ? null : { text: `${_abKr(f.forra)} till ${_abKr(f.nu)}${f.diff == null ? '' : ` (${_abForandringText(f)})`}` });
    // Lönespridningen förra året och i år; ett år utan värdet (en äldre fil) står som streck.
    const spridning = f => (!f || (f.forra == null && f.nu == null) ? null : { text: `${_abSpridningText(f.forra)} till ${_abSpridningText(f.nu)}` });
    return [
        { typ: 'rubrik', niva: 3, text: `Löneutveckling per ${T.niva.en}` },
        { typ: 'stycke', stil: 'dampad', text: `Varje mått ${forraAr} till ${nuAr}, med förändringen i kronor och i procent av ${forraAr} års värde. Bara intervall med minst ${j.kGrans} ${personOrd(j.kGrans)} båda åren; medianen rör sig också när sammansättningen ändras. ${AB_SPRIDNING_NOT}` },
        { typ: 'tabell', kolumner: [{ rubrik: stor(T.niva.en), typ: 'text' }, { rubrik: 'Antal', typ: 'text' }, { rubrik: 'P10', typ: 'text' }, { rubrik: 'Median', typ: 'text' }, { rubrik: 'P90', typ: 'text' }, { rubrik: 'Lönespridning', typ: 'text' }],
          rader: j.basIntervall.map(r => [`BAS ${r.bas}`, antal(r.n), matt(r.p10), matt(r.med), matt(r.p90), spridning(r.spridning)]) },
        ...bilder,   // hanteln för medianen (chart-arsjamforelse-bas)
    ];
}

/**
 * Avsnittet Lönerna mot referenserna (ADR-55): överblickens tal, listan, bilden och statistiken mot ställningstagandet.
 * Finns bara när minst en referens är inläst.
 * @param {(avsnitt: string) => any[]} diagram
 */
function rmReferenserAvsnitt(diagram) {
    const o = referensOverblick();
    if (!o) return null;
    const harStatistik = state.statistik.length > 0, harStallningstagande = state.policy.length > 0;
    const pct = (v, ref) => (v != null && ref != null ? (v / ref - 1) * 100 : null);
    const tecken = v => (v == null ? '—' : `${svTecken(v, 1)}${svPct(v, 1)}`);
    const pm = o.tal.perMonster, monster = m => `${m.grupper} (${svPct(m.andel, 0)} av personalen)`;
    const tal = [[`${stor(T.enhet.fl)} i ${T.niva.en}`, String(o.tal.antalGrupper)],
        ...(harStatistik && harStallningstagande ? [['Löneläget och statistiken över ställningstagandet', monster(pm.badaOver)], ['Bara löneläget över ställningstagandet', monster(pm.baraLonelageOver)],
            ['Bara statistiken över ställningstagandet', monster(pm.baraStatistikOver)], ['Båda inom ställningstagandet', monster(pm.badaInom)], ['Grupper där förslaget är statistiken', String(o.tal.forslagStatistik)]] : []),
        ...(harStallningstagande ? [['Vägd medianskillnad mot ställningstagandet', tecken(o.tal.vagdMedianMotStallningstagandePct)]] : []),
        ...(harStatistik ? [['Vägd medianskillnad mot statistiken', tecken(o.tal.vagdMedianMotStatistikPct)]] : [])];
    const delar = [
        { typ: 'stycke', text: `Ställningstagandet är referenspunkten: löneläget och statistiken mäts mot det. Läget säger var gruppen ligger, inte om en lön är rätt eller fel. ${stor(T.enhet.fl)} under minsta gruppstorlek redovisas inte.`, stil: 'dampad' },
        { typ: 'tabell', nyckel: true, kolumner: [{ rubrik: '', typ: 'text' }, { rubrik: '', typ: 'text' }], rader: tal },
        { typ: 'tabell', kolumner: [{ rubrik: stor(T.enhet.en), typ: 'text' }, ...(harStatistik ? [{ rubrik: 'Matchning', typ: 'text' }] : []), { rubrik: 'n', typ: 'antal' }, { rubrik: 'Median', typ: 'kr' },
            ...(harStallningstagande ? [{ rubrik: 'Mot ställningstagandet', typ: 'pct1' }] : []), ...(harStatistik ? [{ rubrik: 'Mot statistiken', typ: 'pct1' }] : []), { rubrik: 'Läge och förslag', typ: 'text' }],
          rader: o.grupper.map(g => [`${g.yrke} · BAS ${g.bas}`, ...(harStatistik ? [matchningEtikett(g.statistikMatchning)] : []), g.n, g.org.median,
            ...(harStallningstagande ? [pct(g.org.median, g.stallningstagande.median)] : []), ...(harStatistik ? [pct(g.org.median, g.statistik.median)] : []), g.lageOchForslag]) },
        ...diagram('referenser'),
    ];
    if (o.statistikMotStallningstagande.length) delar.push({ typ: 'rubrik', niva: 3, text: 'Statistiken mot ställningstagandet' },
        { typ: 'stycke', text: 'Positivt: statistiken ligger över ställningstagandet. Negativt: statistiken ligger under det. Organisationens löner ingår inte.', stil: 'dampad' },
        { typ: 'tabell', kolumner: [{ rubrik: stor(T.enhet.en), typ: 'text' }, { rubrik: 'BAS', typ: 'text' }, { rubrik: 'P10', typ: 'pct1' }, { rubrik: 'Median', typ: 'pct1' }, { rubrik: 'P90', typ: 'pct1' }],
          rader: o.statistikMotStallningstagande.map(r => [r.yrke, r.bas, r.p10, r.median, r.p90]) });
    const utelamnat = [...(harStatistik ? [] : ['jämförelsestatistik saknas']), ...(harStallningstagande ? [] : ['ställningstagande saknas'])];
    return { id: 'referenser', numrerad: true, rubrik: 'Lönerna mot referenserna', utelamnat, delar };
}

/**
 * Avsnittet Egna tabeller (ADR-52): tabeller användaren byggt i Utforska och lagt till i rapporten. Recepten
 * (state.rapportTabeller) räknas om i vymodellen med samma pivot som fliken och tröskeln k; inga tal lagras.
 * @param {Array<{recept:any, tabeller:any[], skal:string|null}>} egna  ur vymodellen (vymodellRapport)
 * @param {number} k
 */
function rmEgnaAvsnitt(egna, k) {
    if (!egna.length) return null;
    const stycke = (text, stil) => ({ typ: 'stycke', text, ...(stil ? { stil } : {}) });
    /** @type {any[]} */
    const delar = [stycke('Tabeller som byggts i fliken Tabeller och egna vyer och lagts till i rapporten. De räknas på samma underlag och med samma minsta gruppstorlek som rapporten i övrigt.', 'dampad')];
    const utelamnat = [];
    let antal = 0;
    for (const { recept: r, tabeller, skal } of egna) {
        if (!tabeller.length) { utelamnat.push(`tabellen "${r.namn}" (${skal})`); continue; }
        for (const t of tabeller) {
            antal++;
            delar.push({ typ: 'rubrik', niva: 3, text: t.rubrik });
            delar.push({ typ: 'tabell', kolumner: t.kolumner, rader: t.rader });
            if (t.not) delar.push(stycke(t.not, 'not'));
            if (t.utelamnade) utelamnat.push(`${t.utelamnade} ${t.utelamnade === 1 ? 'grupp' : 'grupper'} i "${t.rubrik}" (färre än ${k} ${personOrd(k)})`);
        }
    }
    if (!antal) return null;
    return { id: 'egna', numrerad: true, rubrik: 'Egna tabeller', utelamnat, delar };
}

/**
 * Rapportens avsnitt i vald ordning, numrerade efter urvalet. Med `alla: true` ges alla avsnitt i standardordning
 * (för listan där urvalet görs). Utan lönefil bär avsnitten bara det som inte kräver den (referens, statistik, metod).
 * @param {...any} a - `{ alla?: boolean }`
 * @returns {{titel: string, undertitel: string, demo: boolean, avsnitt: any[], urval: any}}
 */
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
export function rapportModell(...a) { return medExportLage(() => _rapportModellExport.apply(null, /** @type {any} */ (a))); }
/** Modellen i det gällande urvalet och med alla avsnitt ur ett enda bygge (det kostar sekunder på stora underlag). */
export function rapportModellBada({ besked = false, ateranvand = false } = {}) { return medExportLage(() => _rapportModellExport({ bada: true, besked, ateranvand })); }

// ---- Förhandsbeskedets minne ----
// Avsnitten beror inte på urvalet (utom bilagan med gruppdossierer, som byggs för sig). När bara urvalet ändras — ett
// kryss, en flytt eller ett färdigt urval i listan under Exportera — räknas förhandsbeskedet ur det som byggdes senast,
// i stället för att varje avsnitt räknas om (det kostar sekunder på stora underlag). Minnet bär bara det beskedet
// räknar: avsnittens id, rubriker, delarnas typ och de utelämnade texterna (aggregerade antal; inga personrader och
// inga resultat), och k och underlagets kvalitet för undertiteln.
// Ingen fil ritas ur det (bara `besked` får använda det), så regressionen räknas fortfarande om till varje export
// (ADR-17). Minnet gäller bara så länge ingenting annat har hänt: varje annan inmatning i sidan (_rmHandelser), ett
// nytt underlag, en ny tröskel, nya referenser eller bokslut och bakgrundsanalyser som blivit klara gör det ogiltigt.
let _rmHandelser = 0;
/** @type {{nyckel: any[], avsnitt: any}|null} */
let _rmMinne = null;
/** Rensa all data släpper minnet (26-rensning.js). */
export function _rmMinneSlapp() { _rmMinne = null; }
function _rmMinnesNyckel() {
    return [_rmHandelser, state.data.length, hamtaData().length, kTroskel(), state.policy, state.statistik, state.forraArsbokslut, state.rapportTabeller,
        state.perBasRecept, state.forklaringsmodell, state.gapUppdelning, bootstrapKIGallande(), styrkaGallande(), state.likvardighet && state.likvardighet.result, state.isDemo];
}
/** Ett avsnitt som förhandsbeskedet ser det: id, rubrik, delarnas typ och det utelämnade. */
function _rmLattAvsnitt(a) {
    return a && { id: a.id, numrerad: a.numrerad, rubrik: a.rubrik, utelamnat: [...(a.utelamnat || [])], delar: a.delar.map(p => ({ typ: p.typ })) };
}
/**
 * @param {{alla?: boolean, bada?: boolean, besked?: boolean, ateranvand?: boolean}} [val] besked: för förhandsbeskedet,
 *   som bara räknar — bilagan med gruppdossierer får då antalet och det utelämnade men inga texter. ateranvand (bara med
 *   besked): bara urvalet har ändrats; avsnitten tas ur förhandsbeskedets minne när det gäller (se ovan).
 */
function _rapportModellExport({ alla = false, bada = false, besked = false, ateranvand = false } = {}) {
    const nyckel = _rmMinnesNyckel();
    const giltigt = besked && ateranvand && _rmMinne && _rmMinne.nyckel.length === nyckel.length && _rmMinne.nyckel.every((v, i) => v === nyckel[i]);
    const b = giltigt ? /** @type {any} */ (_rmMinne).avsnitt : _rmAvsnittenUtanUrval();
    if (!giltigt) _rmMinne = { nyckel, avsnitt: { ...b, egna: _rmLattAvsnitt(b.egna), arsjamf: _rmLattAvsnitt(b.arsjamf), fasta: b.fasta.map(_rmLattAvsnitt) } };
    const { harData, k, year, today, urval, dqStatus, egna, arsjamf } = b;
    // Bilagan med gruppdossierer byggs bara när den följer med i urvalet. Listan över alla avsnitt (alla, bada) bär den
    // annars med rubriken och utan innehåll: förhandsbeskedet och urvalslistan behöver bara rubriken, och en bilaga
    // som inte är vald kostar då ingenting.
    const dossierer = harData ? rmDossierAvsnitt(k, { stub: !rapportUrval().med.includes('dossierer'), besked }) : null;
    const finns = /** @type {any[]} */ ([...b.fasta, dossierer].filter(Boolean));
    /** @param {boolean} alla */
    const avsnitt = alla => rapportAvsnittIUrval(finns, { urval: rapportUrval(), alla, egna, arsjamf });
    const modell = alla => ({
        titel: `Lönekartläggning ${year} — dokumentation`,
        undertitel: `${orgNamn('') || '[HR fyller i: organisation/arbetsgivare]'} · ${urval} · genererad ${today} · v${APP_VERSION}${dqStatus ? ` · Underlagets kvalitet: ${UK_ETIKETT[dqStatus]}` : ''}`,
        demo: !!state.isDemo,
        avsnitt: avsnitt(alla),
        urval: rapportUrval().namn,
    });
    return bada ? { urval: modell(false), alla: modell(true) } : modell(alla);
}
/** Rapportens avsnitt utom bilagan med gruppdossierer, oberoende av urvalet: det _rapportModellExport väljer och numrerar ur. */
function _rmAvsnittenUtanUrval() {
    const d = hamtaData();
    const year = new Date().getFullYear(), today = new Date().toLocaleDateString('sv-SE');
    const k = kTroskel();
    const urval = 'Hela organisationen';
    const reg = korOLSRegression();
    const lvRes = likvardighetResultat();
    // Allt som räknas, maskeras och bedöms: src/lib/vymodell-rapport.js. Här skrivs orden och delarna.
    const vm = vymodellRapport(d, { k, golv: statGolv(), bas: hamtaBasIntervall(), reg, lika: laLikaGrupper(d, k), lvPar: lvRes && lvRes.pairs,
        oversikt: _laOversiktRader(d, undefined, k), recept: state.rapportTabeller || [],
        basEffektNot: utelamnade => _basEffektNot(utelamnade, k) });
    const { nKv: kvN, nMa: maN, medKv, medMa, kvotPct, konOk } = vm.sammanfattning;
    const { par, utelamnade: parUtelamnade, not: parNot } = vm.likvardigt;   // som rapportunderlaget
    const { visade: repVisade, dolda: repDolda } = vm.representation;
    const dq = bedomningUnderlag({ reg });
    const stycke = (text, stil) => ({ typ: 'stycke', text, ...(stil ? { stil } : {}) });
    const dampad = text => stycke(text, 'dampad');
    const fyllIn = text => ({ typ: 'fyllIn', text });
    /** @param {string} avsnitt @param {string} [del] */
    const diagram = (avsnitt, del) => RM_DIAGRAM.filter(g => g.avsnitt === avsnitt && (/** @type {any} */ (g).del || null) === (del || null) && (!g.kraverAllaPar || vm.likvardigt.allaParVisas) && (!g.om || g.om()))
        .flatMap(g => { const not = g.metodNot ? g.metodNot() : null;
            return [{ typ: 'diagram', id: g.id, flik: g.flik, rubrik: g.rubrik }, ...(not ? [dampad(not)] : [])]; });

    // ---- 1. Sammanfattning och underlag ----
    /** @type {{id: string, rubrik: string, utelamnat: string[], delar: any[], [k: string]: any}} */
    const sammanfattning = { id: 'sammanfattning', numrerad: true, rubrik: 'Sammanfattning och underlag', utelamnat: konOk ? [] : [_konUtelamnatNot()], delar: [
        { typ: 'tabell', nyckel: true, kolumner: [{ rubrik: '', typ: 'text' }, { rubrik: '', typ: 'text' }], rader: [
            ['Antal anställda', `${d.length} (kvinnor: ${kvN}, män: ${maN})`],
            ['Medianlön kvinnor / män', konOk ? `${rmCell(medKv, 'kr')} / ${rmCell(medMa, 'kr')}` : _konUtelamnatNot()],
            ...(kvotPct != null ? [['Kvinnors medianlön i procent av mäns', svPct(kvotPct, 1)]] : []),
            ['Urval', urval],
            ['Referens för lönenivåer', `${referensNamn()}${referensKalla()}`],
            ['Jämförelsestatistik', statistikBeskrivning()],
            ['Rättslig ram', RATTSLIG_RAM],
            ['Ansvar', ANSVARSFORBEHALL],
        ] },
        fyllIn('Sammanfattande slutsats av årets lönekartläggning (övergripande iakttagelser och viktigaste åtgärder).'),
    ] };

    // ---- 2. Regler och praxis ----
    /** @type {{id: string, rubrik: string, utelamnat: string[], delar: any[], [k: string]: any}} */
    const regler = { id: 'regler', numrerad: true, rubrik: 'Regler och praxis kring lön', utelamnat: [], delar: [
        dampad('Granskning av de regler och den praxis som styr lönesättningen — inte lönerna i sig. En regel kan vara könsneutralt skriven och ändå slå olika i praktiken. Redovisas per granskningsområde.'),
    ] };
    if (vm.representation.iakttagelse) {   // bara BAS som får redovisas rangordnas efter median och namnges
        const { topp, botten } = vm.representation.iakttagelse;
        regler.delar.push(stycke(`Automatisk iakttagelse: andelen kvinnor är högre i lägre betalda ${T.niva.fl} (${botten.bas}: ${svPct(botten.andelKv, 0)}) än i högre betalda (${topp.bas}: ${svPct(topp.andelKv, 0)}). Det kan tyda på att kvinnor och män är ojämnt fördelade mellan ${T.niva.bfl}, och det är värt att ta med i granskningen av regler och praxis.`));
    }
    const bes8 = _bes8Omraden();
    if (bes8.length) {
        regler.delar.push({ typ: 'tabell', kolumner: [{ rubrik: 'Granskningsområde', typ: 'text' }, { rubrik: 'Bedömning', typ: 'fyllIn' }, { rubrik: 'Iakttagelser / åtgärd', typ: 'fyllIn' }],
            rader: bes8.map(a => [a.title, a.status || { text: '[HR fyller i]', fyllIn: true }, a.note || { text: '[HR fyller i]', fyllIn: true }]) });
        regler.delar.push(dampad('Bedömningen fylls i på fliken "Regler & praxis" och följer automatiskt med hit.'));
    } else {
        regler.delar.push(fyllIn('Granska lönekriterier och hur de tillämpas; lönesättning vid nyanställning, lönerevision och efter föräldraledighet; samt om någon bestämmelse eller praxis kan missgynna ett kön. Beskriv iakttagelser och eventuella åtgärder.'));
    }

    // ---- 3. Lika arbete ----
    /** @type {{id: string, rubrik: string, utelamnat: string[], delar: any[], [k: string]: any}} */
    const lika = { id: 'lika', numrerad: true, rubrik: `Lika arbete — kvinnor och män i samma ${T.enhet.en} och ${T.niva.en}`, utelamnat: [], delar: [
        dampad(`Den löneskillnad som står kvar ${reg && !reg.error ? (reg.fras ? `när ${reg.fras} räknats bort` : 'utan att något räknats bort') : `när ålder och ${T.niva.en} räknats bort`}, och de ${T.enhet.fl} där skillnaden mellan kvinnors och mäns medianlön är statistiskt säkerställd och minst 3 % (verktygets storleksgräns), statusen Värt att granska. Lagen kräver att varje skillnad prövas; de här sticker ut. Kolumnen ${_STS_DIR_KOLUMN} visar var den ojusterade skillnaden når 5 %: ${_STS_DIR_TIPS}`),
        dampad(termText(AID_METODTEXT)),
    ] };
    if (reg && !reg.error) {
        lika.delar.push({ typ: 'tabell', nyckel: true, kolumner: [{ rubrik: '', typ: 'text' }, { rubrik: '', typ: 'text' }], rader: [
            // Det råa gapet är ett beskrivande könsuppdelat mått och följer tröskeln (_raGapText).
            [_raGapEtikett(reg), _raGapText(reg, v => andelAvMan(v, 1))],
            [reg.fras ? `Löneskillnad som står kvar efter ${reg.fras}` : 'Löneskillnad, inget räknat bort', { text: `${rmCell(reg.konPct, 'tecken2')} (95 % KI: ${svTal(reg.konPctLow, 2)} till ${svPct(reg.konPctHigh, 2)}; ${_formateraPVarde(reg.pValue)})`, fet: true }],
            ['Modell', `log(lön) ~ ${reg.modelDesc} · n = ${reg.n} · R² ${svPct(reg.R2 * 100, 1)}`],
        ] });
        lika.delar.push(dampad(`Löneskillnaden ${reg.fras ? `efter ${reg.fras}` : 'utan kontroller'} anges som en skillnad i procent: negativ när kvinnor ligger lägre.`));
        for (const b of reg.bortvalt || []) lika.delar.push(dampad(bortvaltNotering(b)));
    } else {
        lika.delar.push(dampad('Underlaget räcker inte för att räkna fram den justerade löneskillnaden.'));
    }
    lika.delar.push(...diagram('lika'));
    lika.delar.push({ typ: 'rubrik', niva: 3, text: 'Grupper att bedöma' });
    // Samma grupper som fliken Lika arbete och rapportunderlaget: yrkesgrupper med statusen Värt att granska (säkerställd
    // skillnad på minst 3 %, ADR-59), med tröskeln för varje kön. Grupper under referensen står i avsnittet om åtgärder.
    const attBedoma = vm.lika.grupper;   // uppmärksamhetstrappan (ADR-59), högst RM_LIKA_MAX
    if (attBedoma.length) {
        lika.delar.push({ typ: 'tabell', kolumner: [{ rubrik: stor(T.enhet.en), typ: 'text' }, { rubrik: stor(T.niva.en), typ: 'text' }, { rubrik: 'Kvinnor / män', typ: 'text' }, { rubrik: 'Median kvinnor', typ: 'kr' }, { rubrik: 'Median män', typ: 'kr' },
            { rubrik: 'Kvinnors median i % av mäns', typ: 'pct1' }, { rubrik: _STS_DIR_KOLUMN, typ: 'text' }, { rubrik: 'Saklig förklaring (fyll i)', typ: 'fyllIn' }, { rubrik: 'Åtgärd/beslut (fyll i)', typ: 'fyllIn' }],
            rader: attBedoma.map(g => [g.yrke, String(g.bas ?? ''), `${g.nKv} / ${g.nMa}`, g.medKv, g.medMa, g.kvot * 100, g.direktiv ? _STS_DIR_ETIKETT : '', '', '']) });
        if (vm.lika.overskott) lika.utelamnat.push(`${vm.lika.overskott} ${ordForAntal(vm.lika.overskott, T.enhet)} utöver de ${RM_LIKA_MAX} första`);
    } else {
        lika.delar.push(dampad(`${stor(adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.enhet))} ${T.enhet.en} har statusen Värt att granska: ingen skillnad mellan kvinnors och mäns medianlön är både statistiskt säkerställd och minst 3 %.`));
    }
    const likaSma = vm.lika.sma;
    if (likaSma) lika.utelamnat.push(`könsjämförelsen för ${likaSma} ${ordForAntal(likaSma, T.enhet)} där ett kön har färre än ${k} ${personOrd(k)}`);
    lika.delar.push(fyllIn('Bedöm för varje grupp om löneskillnaden har samband med kön. Ange sakligt skäl (t.ex. dokumenterad erfarenhet, prestation, marknadsläge, tjänstetillägg) eller besluta åtgärd.'));

    // ---- 4. Likvärdigt arbete ----
    /** @type {{id: string, rubrik: string, utelamnat: string[], delar: any[], [k: string]: any}} */
    const likvardigt = { id: 'likvardigt', numrerad: true, rubrik: `Likvärdigt arbete — ${termFras(T.enhet, 'fl', { adjektiv: 'kvinnodominerad' })}`, utelamnat: [], delar: [
        dampad(`${stor(termFras(T.enhet, 'fl', { adjektiv: 'kvinnodominerad' }))} med lägre lön än ${artikel(T.enhet)} ${T.enhet.en} med likvärdiga eller lägre krav. De jämförs med ${T.enhet.fl} på samma nivå som inte är kvinnodominerade${lvJamforelse() === 'mansdominerade' ? ' (här bara de mansdominerade)' : ''}; könsandelen i ${T.jamforelse.bf} står i tabellen. Listan är kandidater att granska. Det är organisationen som avgör om kraven verkligen är likvärdiga.`),
    ] };
    const medNamn = (aid, namn, bas) => `${aid}${namn && namn !== aid ? ' ' + namn : ''} (BAS ${bas})`;
    if (par.length) {
        likvardigt.delar.push({ typ: 'tabell', kolumner: [{ rubrik: '#', typ: 'antal' }, { rubrik: stor(termFras(T.enhet, 'en', { adjektiv: 'kvinnodominerad' })), typ: 'text' }, { rubrik: stor(T.jamforelse.en), typ: 'text' },
            { rubrik: 'Antal (kvinnodom. / jämf.)', typ: 'text' }, { rubrik: `Könsandel i ${T.jamforelse.bf}`, typ: 'text' },
            { rubrik: termText('{Enhet.kort} median högre (kr)'), typ: 'kr' }, { rubrik: 'Högre med (%)', typ: 'pct1' }, { rubrik: 'Kravvärdering / sakligt skäl (fyll i)', typ: 'fyllIn' }],
            rader: par.map((p, i) => [i + 1, medNamn(p.kvAid, p.kvLabel, p.kvBas), medNamn(p.maAid, p.maLabel, p.maBas), `${p.kvN} / ${p.maN != null ? p.maN : '–'}`,
                `${svPct(p.maKvAndel, 0)}${p.maKlass ? ` (${konsklassOrd(p.maKlass)})` : ''}`, p.gapKr, p.gapPct, '']) });
        if (vm.likvardigt.overskott) likvardigt.utelamnat.push(`${vm.likvardigt.overskott} par utöver de ${RM_PAR_MAX} första`);
    } else if (!parNot) {
        likvardigt.delar.push(dampad(`Inga jämförelsepar hittades. Antingen är grupperna för små för att redovisas, eller så ligger ${adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.enhet)} ${termFras(T.enhet, 'en', { adjektiv: 'kvinnodominerad' })} lägre än sin jämförelse.`));
    }
    if (parNot) { likvardigt.delar.push(dampad(parNot)); likvardigt.utelamnat.push(`${parUtelamnade} kandidatpar med en grupp under ${k} ${personOrd(k)}`); }
    likvardigt.delar.push(...diagram('likvardigt'));
    likvardigt.delar.push(fyllIn(`Avgör, utifrån befattningsbeskrivning eller arbetsvärdering, om ${genitiv(T.jamforelse.bf)} krav verkligen är likvärdiga eller lägre. Ange sakligt skäl eller åtgärd för varje par som står kvar.`));

    // ---- 5. Struktur och lönetransparens ----
    // Lönemåtten (median, lönegapet per BAS) redovisas bara för BAS-intervall med minst tröskeln personer.
    // Gapet per BAS står med direktivets tecken (rmDirektivGap), som i EU-lönerapportens blad; översikten per
    // BAS-intervall från Lönestruktur längre ned behåller flikens form (kvinnors lön i procent av mäns med konfidensintervall).
    const repNot = [_rmNotText(kMaskNot(repDolda, `${T.niva.en}|${T.niva.fl}`)), _rmNotText(kSamladNot(vm.representation.konLitet, `${T.niva.en}|${T.niva.fl}`))].filter(Boolean);
    const oversikt = vm.oversikt;
    const struktur = (repVisade.length || repNot.length) ? { id: 'struktur', numrerad: true, rubrik: 'Struktur och lönetransparens',
        utelamnat: [...(repDolda.length ? [`BAS ${repDolda.join(', ')} (färre än ${k} ${personOrd(k)})`] : []),
            ...(vm.representation.konLitet.length ? [`könsuppdelade lönemått för BAS ${vm.representation.konLitet.join(', ')} (ett kön har färre än ${k} ${personOrd(k)})`] : [])], delar: [
            dampad(`Hur kvinnor och män fördelar sig mellan ${T.niva.bfl}, och löneskillnaden i median i varje intervall, räknad som i direktivet: skillnaden i procent av mäns lön, positivt tal = kvinnor lägre. Verktygets flikar visar samma skillnad som kvinnors lön i procent av mäns.`),
            dampad(EU_LONEBEGREPP_RESERVATION),
            ...(repVisade.length ? [{ typ: 'tabell', kolumner: [{ rubrik: 'BAS', typ: 'text' }, { rubrik: 'N', typ: 'antal' }, { rubrik: 'Andel kvinnor', typ: 'pct0' }, { rubrik: 'Median', typ: 'kr' }, { rubrik: RM_DIREKTIV_RUBRIK, typ: 'direktiv' }, { rubrik: _STS_DIR_KOLUMN, typ: 'text' }],
                rader: repVisade.map(g => [g.bas, g.n, g.andelKv, g.median, g.gapPct == null ? null : g.gapPct, g.gapPct != null && direktivMarkering(100 + g.gapPct) ? _STS_DIR_ETIKETT : '']) }] : []),
            ...repNot.map(t => stycke(t, 'not')),
            // Samma översikt som BAS-översikten i Lönestruktur: en rad per BAS-intervall där båda könen når tröskeln,
            // ur samma beräkning (_laOversiktRader). Kvoten med sitt konfidensintervall och status står i ord — i
            // Word och PDF finns ingen grafik i raden; bilden under tabellen visar samma kvot.
            ...(oversikt.length ? [{ typ: 'rubrik', niva: 3, text: `Kvinnors och mäns lön per ${T.niva.en}` },
                { typ: 'tabell', kolumner: [{ rubrik: 'BAS', typ: 'text' }, { rubrik: 'Kvinnor / män', typ: 'text' }, { rubrik: 'Median kvinnor', typ: 'kr' }, { rubrik: 'Median män', typ: 'kr' },
                    { rubrik: 'Skillnad', typ: 'text' }, { rubrik: 'Kvinnors lön i % av mäns', typ: 'pct1' }, { rubrik: '95 % konfidensintervall', typ: 'text' }, { rubrik: 'Status', typ: 'text' }, { rubrik: _STS_DIR_KOLUMN, typ: 'text' }],
                  rader: oversikt.map(o => { const skillnad = o.skillnadKr;
                      return [o.bas, `${o.nKv} / ${o.nMa}`, o.medKv, o.medMa, `${skillnad < 0 ? '−' : skillnad > 0 ? '+' : ''}${rmCell(Math.abs(skillnad), 'kr')}`, o.gap,
                              o.ci ? `${svTal(o.ci.lo, 1)}–${svPct(o.ci.hi, 1)}` : '—', gapStatusNiva(o.niva).serie, o.direktiv ? _STS_DIR_ETIKETT : '']; }) },
                dampad(`Skillnaden är kvinnors medianlön minus mäns. Når konfidensintervallet 100 % kan skillnaden bero på slumpen. Statusen Värt att granska: intervallet når inte 100 % och skillnaden är minst 3 % (verktygets storleksgräns). ${_STS_DIR_KOLUMN}: ${_STS_DIR_TIPS} Bara ${T.niva.fl} där både kvinnor och män når minsta gruppstorlek har en rad.`)] : []),
            ...diagram('struktur'),
        ] } : null;

    // ---- Lönekartläggning per BAS-intervall (BAS-dossierns stycken, 81-basdossier.js) ----
    const basintervall = d.length ? rmBasintervallAvsnitt(k, vm.basintervall) : null;

    // ---- Lönestruktur per BAS-intervall (tabellerna ur arbetsgivarnas egna utkast) ----
    const perbas = rmPerBasAvsnitt(d, k);
    const referenser = d.length ? rmReferenserAvsnitt(diagram) : null;
    const egna = rmEgnaAvsnitt(vm.egna, k);
    const arsjamf = d.length ? rmArsjamforelseAvsnitt(diagram) : null;

    // ---- 6. Åtgärder och tidsplan ----
    // Tabellen är handlingsplanen från fliken (samma förifyllning, som redan utelämnar par under tröskeln), med det som
    // fyllts i där; ett tomt fält står kvar att fylla i.
    const hpSeed = _handlingsplanForifyllning();
    const hp = hpSeed.rows;
    const hpSkal = _hpSkalUnderlag(hpSeed);
    const hpFalt = v => v || { text: '[HR fyller i]', fyllIn: true };
    /** @type {{id: string, rubrik: string, utelamnat: string[], delar: any[], [k: string]: any}} */
    const atgarder = { id: 'atgarder', numrerad: true, rubrik: 'Åtgärder och tidsplan', utelamnat: [], delar: [
        dampad(`Planerade lönejusteringar och andra åtgärder, med beslut, ansvar och tidsplan. Tabellen visar åtgärderna. Den tar med de grupper som ligger under referensen enligt prioriteringen och kandidatparen i likvärdigt arbete, med uppskattad kostnad och det som fyllts i på fliken Handlingsplan. Kolumnen Kostnaden avser säger vilken kostnad raden har. För grupperna ur prioriteringen (Nå referensens median) är kostnaden kostnad att nå referensen: löneläget mot er referens, inte lönekartläggningens könsskillnader. För kandidatparen (Nå ${genitiv(T.jamforelse.bf)} median) är den kostnaden att lyfta ${termFras(T.enhet, 'bf', { adjektiv: 'kvinnodominerad' })} till ${genitiv(T.jamforelse.bf)} median.`),
        hp.length
            ? { typ: 'tabell', kolumner: [{ rubrik: 'Grupp', typ: 'text' }, { rubrik: 'Antal berörda', typ: 'antal' }, { rubrik: 'Underlag', typ: 'text' }, { rubrik: 'Uppskattad kostnad', typ: 'krAr' }, { rubrik: 'Kostnaden avser', typ: 'text' }, { rubrik: 'Sakliga skäl prövade?', typ: 'fyllIn' }, { rubrik: 'Ansvarig', typ: 'fyllIn' }, { rubrik: 'Tidsplan (senast inom tre år)', typ: 'fyllIn' }, { rubrik: 'Status', typ: 'fyllIn' }],
                // Antal berörda: gruppens antal (för ett kandidatpar det kvinnodominerade yrkets); tomt för en egen rad.
                // Kostnaden avser (_hpKostnadAvser): vilken kostnad raden har; tomt för en egen rad.
                rader: hp.map(r => [r[1], r[8] != null ? r[8] : { text: '' }, r[2], r[4] ? Math.round(r[4]) : null, { text: _hpKostnadAvser(r[2]) }, hpFalt(r[3]), hpFalt(r[5]), hpFalt(r[6]), hpFalt(r[7])]) }
            : dampad(state.policy.length || state.statistik.length ? 'Inga grupper under referensen och inga kandidatpar att föra in i handlingsplanen.' : 'Inga prioriterade åtgärdsgrupper (inget ställningstagande eller ingen jämförelsestatistik inläst).'),
        ...rmSakligaSkalDelar(hpSkal, dampad),
        fyllIn('Besluta åtgärder, budget och tidsplan (lönejusteringar ska genomföras så snart som möjligt och senast inom tre år). Beskriv även förebyggande åtgärder.'),
    ] };

    /** @type {{id: string, rubrik: string, utelamnat: string[], delar: any[], [k: string]: any}} */
    const samverkan = { id: 'samverkan', numrerad: true, rubrik: 'Samverkan med arbetstagarna', utelamnat: [], delar: [
        fyllIn('Dokumentera samverkan med arbetstagarorganisationerna: datum, deltagande parter och synpunkter (protokollet för gemensam lönebedömning kan bifogas).')] };
    /** @type {{id: string, rubrik: string, utelamnat: string[], delar: any[], [k: string]: any}} */
    const beslut = { id: 'beslut', numrerad: true, rubrik: 'Beslut och underskrift', utelamnat: [], delar: [
        fyllIn('Beslutsfattare, datum och underskrift. Ange när nästa lönekartläggning ska genomföras (årligen).')] };
    // ---- Bilaga: det justerade lönegapet i detalj ----
    // Regressionens gap anges som skillnad i procent, negativ när kvinnor ligger lägre. Första steget ("Endast kön")
    // och den förklarade andelen följer tröskeln (regStegForRedovisning i src/lib/ktroskel.js, ADR-12).
    const nyckel = rader => ({ typ: 'tabell', nyckel: true, kolumner: [{ rubrik: '', typ: 'text' }, { rubrik: '', typ: 'text' }], rader });
    /** @type {{id: string, rubrik: string, utelamnat: string[], delar: any[], [k: string]: any}} */
    const regression = { id: 'regression', rubrik: 'Bilaga: Justerad löneskillnad i detalj', utelamnat: [], delar: [] };
    if (vm.regression) {
        const stegUt = vm.regression.steg;
        const kritisk = vm.regression.kritisk;   // säkerställd och minst 3 % (ADR-59); regressionens tal bär ingen direktivmarkering
        const basEffUt = vm.regression.basEffekter;   // intervall under tröskeln utelämnas och namnges (ADR-70)
        regression.delar.push(
            dampad(`Skattad modell: log(lön) ~ ${reg.modelDesc} (OLS-regression). Löneskillnaden anges i procent: negativ när kvinnor ligger lägre.`),
            nyckel([
                ['Antal observationer', `${reg.n} (kvinnor: ${reg.nKvAnalysed}, män: ${reg.nMaAnalysed})`],
                [_raGapEtikett(reg), _raGapText(reg, v => andelAvMan(v, 1))],
                [`Oförklarad skillnad${kritisk ? ' (statistiskt säkerställd och minst 3 %)' : ''}`, { text: `${rmCell(reg.konPct, 'tecken2')} (95 % KI: ${svTal(reg.konPctLow, 2)} till ${svTal(reg.konPctHigh, 2)}, ${_formateraPVarde(reg.pValue)}, t = ${svTal(reg.tStat, 2)}; HC3 robust SE)`, fet: true }],
                ...(reg.ageEffect != null ? [['Ålderseffekt', `${rmCell(reg.ageEffect, 'tecken2')} per år`]] : []),
                ['R² / justerad R²', `${svPct(reg.R2 * 100, 1)} / ${svPct(reg.adjR2 * 100, 1)}`],
                ...(reg.basRef != null && !reg.modell.yrkesgrupp ? [[`${stor(T.niva.fl)} i modellen`, `${reg.nBas} (${reg.basList[0]}–${reg.basList[reg.basList.length - 1]}; indikatorvariabler, ${reg.basRef} är referens)`]] : []),
                ...(reg.modell.yrkesgrupp && reg.yrkesSteg ? [[`${stor(T.enhet.fl)} i modellen`, `${reg.yrkesSteg.nGrupper} grupper (AID inom BAS; fasta effekter), ${reg.yrkesSteg.nGrupperBada} med båda könen`]] : []),
                ...(basEffUt.effekter?.length ? [['BAS-effekter', `nivå mot BAS ${reg.basRef}: ${basEffUt.effekter.map(e => `${e.bas} ${rmCell(e.pct, 'tecken2')} (${_formateraPVarde(e.p)})`).join('; ')}`]] : []),
            ]));
        if (basEffUt.not) { regression.delar.push(stycke(basEffUt.not, 'not')); regression.utelamnat.push(basEffUt.referensUtelamnad ? 'BAS-effekterna (referensintervallet under tröskeln)' : 'BAS-effekter för intervall under tröskeln'); }
        // Det bortvalda (ADR-56): en mening per variabel, med skälet.
        for (const b of reg.bortvalt || []) regression.delar.push(stycke(bortvaltNotering(b)));
        if (reg.fellBackFromFull && reg.diagnostics.length) regression.delar.push(stycke(`Notering: den valda modellen kunde inte skattas. Föll tillbaka till ${reg.modelDesc}. ${reg.diagnostics.map(utanTaggar).join(' ')}`));
        regression.delar.push({ typ: 'rubrik', niva: 3, text: 'Sekventiell dekomponering' },
            { typ: 'tabell', caption: antalText(reg.nKvAnalysed, reg.nMaAnalysed), kolumner: [{ rubrik: 'Modell', typ: 'text' }, { rubrik: 'Löneskillnad', typ: 'tecken2' }, { rubrik: 'R²', typ: 'pct1' }],
              rader: stegUt.steg.map(st => (st.status !== 'ok' ? [stegEtikett(st.name), { text: STATUS_NOT[st.status] }, null] : [stegEtikett(st.name), st.gapPct, st.R2 * 100])) });
        if (reg.yrkesSteg?.status === 'ok') regression.delar.push(stycke(`Steget ${stegEtikett(_RG_STEG_YRKE)}: ${utanTaggar(_yrkesStegText(reg.yrkesSteg, reg.modell))}`));
        if (stegUt.utelamnat) { regression.delar.push(stycke(stegUt.not, 'not')); regression.utelamnat.push('första steget i dekomponeringen (ett kön under tröskeln)'); }
        else if (stegUt.explainedShare !== null) regression.delar.push(stycke(stegUt.explainedShare < 0
            ? `Strukturellt förklarad andel: ingen. När de strukturella variablerna (${reg.fras}) räknas bort blir löneskillnaden större än den råa. Oförklarad rest: ${svPct(100 - stegUt.explainedShare, 0)} av den råa.`
            : `Strukturellt förklarad andel: ${svPct(stegUt.explainedShare, 0)} av den råa löneskillnaden förklaras av strukturella variabler (${reg.fras}). Oförklarad rest: ${svPct(100 - stegUt.explainedShare, 0)}.`));
        const perBas = vm.regression.perBas;
        if (perBas.length) regression.delar.push({ typ: 'rubrik', niva: 3, text: `Per ${T.niva.en} (separata regressioner)` },
            { typ: 'tabell', kolumner: [{ rubrik: 'BAS', typ: 'text' }, { rubrik: 'N', typ: 'antal' }, { rubrik: 'Kvinnor / män', typ: 'text' }, { rubrik: 'Oförklarad skillnad', typ: 'tecken2' }, { rubrik: 'Signifikans', typ: 'text' }, { rubrik: 'Säkerställd, minst 3 %', typ: 'text' }],
              rader: perBas.map(pb => [pb.bas, pb.n, `${pb.kvN} / ${pb.maN}`, pb.gapPct, _formateraPVarde(pb.pValue), pb.sakerstalld ? 'ja' : '']) });
    } else if (reg && reg.error) {
        regression.delar.push(stycke(reg.error));
        const forsok = (reg.triedSteps || []).map(st => `${st.desc || st.name}${STATUS_NOT[st.status] ? ` (${STATUS_NOT[st.status]})` : ''}`);
        if (forsok.length) regression.delar.push(dampad(`Försökta modellspecifikationer: ${forsok.join('; ')}.`));
        if ((reg.diagnostics || []).length) regression.delar.push(dampad(`Identifierade orsaker: ${reg.diagnostics.map(utanTaggar).join(' ')}`));
    }
    const regressionAvsnitt = regression.delar.length ? regression : null;

    /** @type {{id: string, rubrik: string, utelamnat: string[], delar: any[], [k: string]: any}} */
    const metod = { id: 'metod', rubrik: 'Bilaga: Metod och parametrar', utelamnat: [], delar: [
        dampad('Dessa uppgifter följer med så att analysen går att återskapa och förstå. Verktyget pekar ut kandidater för bedömning — det dömer inte.'),
        { typ: 'tabell', nyckel: true, kolumner: [{ rubrik: '', typ: 'text' }, { rubrik: '', typ: 'text' }], rader: _metodbilaga().map(([n, v]) => [String(n), String(v)]) },
        // Metodreservationen om ålder (S7, ADR-64), oavsett om lönefilen har ålder.
        dampad(`${ALDER_METODVAL_TEXT}${harAlder() ? '' : ` ${ALDER_SAKNAS_TEXT}`}`),
    ] };

    return { harData: d.length > 0, k, year, today, urval, dqStatus: dq ? dq.status : null, egna, arsjamf, fasta: [sammanfattning, regler, lika, likvardigt, basintervall, struktur, referenser, perbas, atgarder, samverkan, beslut, regressionAvsnitt, metod] };
}

/**
 * Modellen som HTML, med klasserna (`muted`, `fillin`, `draftbox`) som omvandlingen till Word-block (_utkastTillBlock)
 * och utskriften läser. Ett diagram blir en <figure data-rm-bild="id">.
 * @param {any} m
 * @param {{utskrift?: boolean, bilder?: Map<string, {url: string, alt: string}>|null}} [opts]
 */
export function rmTillHtml(m, { utskrift = false, bilder = null } = {}) {
    if (!m || !m.avsnitt.length) return '';
    const cell = (v, typ) => {
        const t = esc(rmCell(v, typ));
        if (v && typeof v === 'object' && v.fyllIn) return `<em>${t}</em>`;
        if (v && typeof v === 'object' && v.fet) return `<strong>${t}</strong>`;
        return t || '&nbsp;';
    };
    const del = p => {
        if (p.typ === 'stycke') return p.stil === 'fet' ? `<p><strong>${esc(p.text)}</strong></p>`
            : `<p${p.stil === 'dampad' ? ' class="muted"' : p.stil === 'not' ? ' class="k-mask-note"' : ''}>${esc(p.text)}</p>`;
        if (p.typ === 'fyllIn') return `<div class="fillin"><strong>[HR fyller i]</strong> ${esc(p.text)}</div>`;
        if (p.typ === 'rubrik') return `<h${p.niva}>${esc(p.text)}</h${p.niva}>`;
        if (p.typ === 'diagram') {
            if (!utskrift) return `<figure data-rm-bild="${esc(p.id)}" data-rm-flik="${esc(p.flik)}"><figcaption>${esc(p.rubrik)}</figcaption></figure>`;
            const b = bilder && bilder.get(p.id);   // ett diagram utan bild (inte ritat) följer inte med i utskriften
            return b ? `<figure class="rm-bild"><img src="${b.url}" alt="${esc(b.alt)}"><figcaption>${esc(p.rubrik)}</figcaption></figure>` : '';
        }
        if (p.typ === 'tabell') {
            if (p.nyckel) return `<table>${p.rader.map(r => `<tr><th>${esc(rmCell(r[0], 'text'))}</th><td>${cell(r[1], p.kolumner[1].typ)}</td></tr>`).join('')}</table>`;
            return `<table>${p.caption ? `<caption>${esc(p.caption)}</caption>` : ''}<thead><tr>${p.kolumner.map(c => `<th>${esc(c.rubrik)}</th>`).join('')}</tr></thead><tbody>`
                + p.rader.map(r => `<tr>${r.map((v, i) => `<td>${cell(v, p.kolumner[i].typ)}</td>`).join('')}</tr>`).join('') + '</tbody></table>';
        }
        return '';
    };
    // En klass, inget style-attribut: utskriftsrapporten ligger i verktygets dokument och Word-vägen tolkas med DOMParser, som ärver
    // CSP:n (style-src-attr 'none'). Word-utkastet läser rutan på klassen draftbox; färgerna för PDF-rapporten står i stilmallen.
    const demo = m.demo ? `<div class="draftbox draftbox-demo"><strong>DEMODATA</strong> — ${utskrift ? 'denna rapport' : 'detta utkast'} bygger på syntetisk exempeldata och är INTE en verklig lönekartläggning.</div>` : '';
    const ruta = utskrift
        ? '<div class="draftbox"><strong>Låst kopia.</strong> Samma innehåll som Word-utkastet vid samma tillfälle, att verifiera mot. Fälten märkta <em>[HR fyller i …]</em> fylls i och beslutas i Word-dokumentet.</div>'
        : '<div class="draftbox"><strong>⚠ UTKAST att färdigställa.</strong> Verktygets analysfynd är ifyllda nedan. De gulmarkerade <em>[HR fyller i …]</em>-fälten är de kvalitativa bedömningar som diskrimineringslagen kräver att organisationen gör och dokumenterar. Granska alla siffror, fyll i bedömningarna, och spara som <strong>.docx</strong> när dokumentet är klart. Utkastet ersätter inte organisationens slutliga, beslutade dokumentation.</div>';
    const avsnitt = a => `<h2>${esc(a.rubrik)}</h2>${a.delar.map(del).join('')}`;
    return demo + `<h1>${esc(m.titel)}</h1><p class="muted">${esc(m.undertitel)}</p>` + ruta
        + m.avsnitt.map(a => (utskrift ? `<section class="rm-avsnitt" data-rm-avsnitt="${esc(a.id)}">${avsnitt(a)}</section>` : avsnitt(a))).join('');
}

/** Vad en export ur modellen kommer att innehålla och utelämna — underlaget till förhandsbeskedet. */
export function rmBesked(m) {
    const delar = m.avsnitt.flatMap(a => a.delar);
    // Diagramdelarna i urvalet, utan att någon flik ritas: filen utelämnar ett diagram utan något att visa över
    // tröskeln (rmDiagramBild), så antalet är det högsta filen kan få.
    const diagram = delar.filter(p => p.typ === 'diagram').length;
    return { avsnitt: m.avsnitt.length, tabeller: delar.filter(p => p.typ === 'tabell').length, diagram,
        fyllIn: delar.filter(p => p.typ === 'fyllIn').length, utelamnat: [...new Set(m.avsnitt.flatMap(a => a.utelamnat || []))], urval: m.urval };
}

/**
 * Ritas diagramdelen? Fliken som äger diagrammet ritas först, en gång per flik i `ritade`. Provet för filerna
 * (rmDiagramBild).
 */
export function rmDiagramRitas(del, ritade = new Set()) {
    if (del.flik && !ritade.has(del.flik)) { ritade.add(del.flik); try { ritaFlik(del.flik); } catch (e) { rapporteraFel(`rapportens diagram (${del.flik})`, e); } }
    const el = document.getElementById(del.id);
    return !!el && diagramRitat(el);
}
const RM_BILD = { bredd: 1400, hojd: 620 };
/**
 * Bilden till en diagramdel, som data-URL (PNG). Fliken som äger diagrammet ritas först (utan att visas), och bilden
 * görs ur figuren på samma väg som diagrammens egna exportknappar — utan små grupper och med meningen om sänkt
 * tröskel. Null när diagrammet inte ritas (underlaget når inte tröskeln) eller bilden inte går att göra (då rapporteras felet).
 */
export async function rmDiagramBild(del, ritade = new Set()) {
    try {
        if (!rmDiagramRitas(del, ritade)) return null;
        const el = /** @type {any} */ (document.getElementById(del.id));
        const url = String(await diagramTillBild(el, { ...RM_BILD, utanRubrik: true }));
        if (!/^data:image\/png/.test(url) || !url.split(',')[1]) return null;
        return { url, base64: url.split(',')[1], alt: el._exportBeskrivning || del.rubrik, ...RM_BILD };
    } catch (e) { rapporteraFel(`rapportens diagram (${del.id})`, e); return null; }
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartRapportmodell() {
    ['input', 'change', 'click', 'keydown'].forEach(typ => document.addEventListener(typ, e => {
        const el = /** @type {HTMLElement} */ (e.target);
        if (!(el && el.closest && el.closest('#rapport-urval .urval-rad[data-urval-id], #rapport-urval .urval-fasta'))) _rmHandelser++;
    }, true));
}

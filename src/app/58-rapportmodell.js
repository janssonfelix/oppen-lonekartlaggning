// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 58-rapportmodell.js — Rapportmodellen (ADR-40)
//
// Rapportens avsnitt som data: stycken, tabeller med tal som tal, diagram och fält att fylla i. Exporterna ritas ur
// modellen i stället för att var och en räkna och formulera själv.
//
// Delar: { typ: 'stycke', text, stil? } (stil: dampad | not) · { typ: 'fyllIn', text } · { typ: 'rubrik', niva, text } ·
//        { typ: 'tabell', kolumner: [{ rubrik, typ }], rader: [[värde]], nyckel? } · { typ: 'diagram', id, flik, rubrik } ·
// Kolumntyper: text, antal, ar (ålder i år), kr, krAr, pct0, pct1, pct2, tecken2 (procent med tecken), andelAvMan, direktiv, fyllIn.
// Ett värde kan också vara { text } (färdig text, t.ex. en förklaring i stället för ett tal) eller null (streck).
//
// Dataskydd: tröskeln tillämpas HÄR, när modellen byggs — med samma funktioner som vyerna och rapportunderlaget
// (isKMasked, _konFarRedovisas, _parForRedovisning, _raGapText). Den som ritar formaterar bara. Varje avsnitt
// säger i `utelamnat` vad det inte redovisar; det är underlaget till exporternas förhandsbesked.
// ====================================================================

/** Lönegapets form i exporterna: kvinnors lön i procent av mäns. `gapPct` är (kvinnor − män) / män. */
function rmAndelAvMan(gapPct, dec = 1) { return andelAvMan(gapPct, dec); }
/** Avsnittet om lönetransparens (EU 2023/970) har direktivets tecken (art. 9): (män − kvinnor) / män, positivt när
 *  kvinnor ligger lägre, med tecknet utskrivet. Samma tal som i EU-lönerapportens blad. */
function rmDirektivGap(gapPct, dec = 1) { const v = _stTillDirektivtecken(gapPct); return v == null ? '—' : `${v > 0 ? '+' : ''}${svPct(v, dec)}`; }
const RM_DIREKTIV_RUBRIK = 'Lönegap enligt art. 9';

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
    if (typ === 'kr') return `${svTal(Math.round(v), 0)} kr`;
    if (typ === 'krAr') return `${svTal(Math.round(v), 0)} kr/år`;
    if (typ === 'pct0') return svPct(v, 0);
    if (typ === 'pct1') return svPct(v, 1);
    if (typ === 'pct2') return svPct(v, 2);
    if (typ === 'tecken2') return `${v >= 0 ? '+' : ''}${svPct(v, 2)}`;
    if (typ === 'andelAvMan') return rmAndelAvMan(v);
    if (typ === 'direktiv') return rmDirektivGap(v);
    return String(v);
}

// Texten ur en not som vyerna bygger som HTML (kMaskNote, kSamladNote): namnen är redan escapade där.
function _rmNotText(html) {
    if (!html) return '';
    const d = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    return d.body.textContent.replace(/\s+/g, ' ').trim();
}

// Diagram som följer med i rapporten: id på diagrammet, fliken som ritar det och avsnittet det hör till.
// Ett diagram som inte ritas — för att underlaget inte når tröskeln — följer inte med.
const RM_DIAGRAM = [
    { id: 'chart-skevhet-overview', flik: 'matrix', avsnitt: 'struktur', rubrik: 'Kvinnors medianlön i procent av mäns, per BAS-intervall — samma kvot och intervall som tabellen ovan' },
    { id: 'chart-skevhet-andel', flik: 'matrix', avsnitt: 'struktur', rubrik: 'Könsfördelning per BAS-intervall' },
    { id: 'chart-struktur-kvartiler', flik: 'struktur', avsnitt: 'struktur', rubrik: 'Kvinnor och män per lönekvartil' },
    { id: 'chart-perbas-gap', flik: 'matrix', avsnitt: 'lika', rubrik: 'Oförklarat lönegap per BAS-intervall' },
    { id: 'chart-la-tratt', flik: 'matrix', avsnitt: 'lika', rubrik: 'Yrkesgrupperna mot slumpens gränser — kvinnors medianlön i procent av mäns mot gruppens storlek',
      // Samma förbehåll som under diagrammet på skärmen, räknat ur den ritade figuren.
      metodNot: () => { const f = /** @type {any} */ (document.getElementById('chart-la-tratt'))?._figur;
          return f ? _laTrattGlesNot(f.lager.filter(l => l.marke === 'punkt').reduce((n, l) => n + l.data.length, 0)) : null; } },
    // Ålder & karriär följer flikens eget val av BAS-intervall: bilden tas bara med när fliken visar hela urvalet,
    // så att rapporten aldrig bär ett diagram för ett enda intervall under en rubrik som gäller alla.
    { id: 'chart-kon-aldergap', flik: 'kon', avsnitt: 'struktur', rubrik: 'Lönegap per åldersgrupp — rå skillnad, alla yrken och nivåer',
      om: () => { const v = /** @type {HTMLInputElement} */ ((document.getElementById('bas-select-kon') || {})).value; return !v || v === '__ALLA__'; } },
    { id: 'chart-lp-konlagen', flik: 'lonepolitik', avsnitt: 'struktur', rubrik: 'Var i referensens lönespann ligger kvinnor och män' },
    { id: 'chart-likvardighet-heatmap', flik: 'likvardighet', avsnitt: 'likvardigt', rubrik: 'Kandidatpar i likvärdigt arbete', kraverAllaPar: true },
];

// ---- Urval: vilka avsnitt som följer med, och i vilken ordning ----
// Urvalet ligger i minnet (state.rapportUrval) och följer med i konfigurationsfilen. null = hela dokumentationen.
const RM_AVSNITT = ['sammanfattning', 'regler', 'lika', 'likvardigt', 'struktur', 'perbas', 'atgarder', 'samverkan', 'beslut', 'regression', 'metod'];
const RM_URVAL = Object.freeze({
    hela: { namn: 'Hela dokumentationen', med: RM_AVSNITT },
    ledning: { namn: 'Ledningsbrief', med: ['sammanfattning', 'lika', 'likvardigt', 'atgarder'] },
    facklig: { namn: 'Facklig dialog', med: ['sammanfattning', 'regler', 'lika', 'likvardigt', 'struktur', 'perbas', 'samverkan', 'regression', 'metod'] },
});
/** Det gällande urvalet: `ordning` är alla avsnitt i vald ordning, `med` de som följer med, `namn` vad urvalet heter. */
function rapportUrval() {
    const u = state.rapportUrval;
    const ordning = u && Array.isArray(u.ordning) ? [...u.ordning.filter(id => RM_AVSNITT.includes(id)), ...RM_AVSNITT.filter(id => !u.ordning.includes(id))] : [...RM_AVSNITT];
    const med = u && Array.isArray(u.med) ? ordning.filter(id => u.med.includes(id)) : [...ordning];
    const lika = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    const fast = Object.values(RM_URVAL).find(f => lika(ordning, RM_AVSNITT) && lika(med, f.med));
    return { ordning, med, namn: fast ? fast.namn : `Eget urval (${med.length} av ${ordning.length} avsnitt)` };
}
/** Sätter urvalet. Ett fast urval anges med sitt namn ('hela', 'ledning', 'facklig'); annars { ordning, med }. */
function sattRapportUrval(u) {
    if (typeof u === 'string') u = u === 'hela' || !RM_URVAL[u] ? null : { ordning: [...RM_AVSNITT], med: [...RM_URVAL[u].med] };
    state.rapportUrval = u ? { ordning: u.ordning.filter(id => RM_AVSNITT.includes(id)), med: u.med.filter(id => RM_AVSNITT.includes(id)) } : null;
}

/**
 * Underlaget till avsnittet Lönestruktur per BAS-intervall: samma tre tabeller i Word-utkastet och Excel-filen.
 * @param {any[]} d
 * @param {number} k
 */
function rmPerBasUnderlag(d, k) {
    if (typeof _pbTabeller !== 'function' || !d.length) return null;
    return _pbTabeller(d, { k, referens: (aid, bas) => policyFor(aid, bas), statistik: state.statistik, recept: state.perBasRecept,
        referensNamn: referensKortnamn(), statistikNamn: state.statistik.length ? (state.statistikNamn || 'Jämförelsestatistik') : 'Jämförelsestatistik' });
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
    const MATT = { p10: 'P10', p25: 'P25', med: 'Median', p75: 'P75', p90: 'P90', medel: 'Medellön' };
    const matt = pb.recept.matt;
    const kol = [{ rubrik: 'Grupp', typ: 'text' }, { rubrik: 'Antal', typ: 'antal' }, ...matt.map(m => ({ rubrik: MATT[m], typ: 'kr' }))];
    const dimEtikett = pb.dimEtikett, kort = pb.dim === 'sektor' ? 'sektor' : 'BAS', per = pb.dim === 'sektor' ? 'sektor' : 'BAS-intervall';
    const utelamnat = [];
    if (pb.basUtelamnade.length) utelamnat.push(`BAS ${pb.basUtelamnade.join(', ')} (färre än ${k} personer)`);
    const smaYrken = pb.intervall.reduce((s, i) => s + i.utelamnade.length, 0);
    if (smaYrken) utelamnat.push(`${smaYrken} ${smaYrken === 1 ? 'yrkesgrupp' : 'yrkesgrupper'} med färre än ${k} personer`);
    const konDolda = pb.intervall.filter(i => !i.konVisas).map(i => i.bas);
    if (konDolda.length) utelamnat.push(`könsuppdelade lönemått för BAS ${konDolda.join(', ')} (ett kön har färre än ${k} personer)`);
    /** @type {any[]} */
    const delar = [
        stycke(pb.dim === 'sektor'
            ? 'Löneläget i varje sektor (AID-huvudområde): organisationen, de yrkesgrupper som når minsta gruppstorlek, och kvinnor och män. P10 och P90 är den tionde och nittionde percentilen.'
            : `Löneläget i varje BAS-intervall mot ${referensKortnamn()}: organisationen, de yrkesgrupper som når minsta gruppstorlek (med jämförelsestatistikens nivå under, när den finns) och kvinnor och män. P10 och P90 är den tionde och nittionde percentilen.`, 'dampad'),
    ];
    for (const i of pb.intervall) {
        delar.push({ typ: 'rubrik', niva: 3, text: `${dimEtikett} ${i.bas}` });   // "BAS-intervall D" / "Sektor Vård"
        delar.push(stycke(`${i.n} ${i.n === 1 ? 'anställd' : 'anställda'} i ${i.antalYrken} ${i.antalYrken === 1 ? 'yrkesgrupp' : 'yrkesgrupper'}, varav ${i.nKv} kvinnor och ${i.nMa} män.`));
        delar.push({ typ: 'tabell', kolumner: kol, rader: i.rader.map(r => [r.namn, r.n, ...matt.map(m => r[m] ?? null)]) });
        const noter = [];
        if (i.utelamnade.length) noter.push(`${i.utelamnade.length} ${i.utelamnade.length === 1 ? 'yrkesgrupp' : 'yrkesgrupper'} med färre än ${k} personer redovisas inte: ${i.utelamnade.join(', ')}.`);
        if (!i.konVisas) noter.push(`Kvinnor och män redovisas inte var för sig eftersom ett kön har färre än ${k} personer i intervallet.`);
        if (noter.length) delar.push(stycke(noter.join(' '), 'not'));
        delar.push({ typ: 'fyllIn', text: `Bedömning av ${kort} ${i.bas}: löneläget mot referensen och jämförelsestatistiken, de största yrkesgrupperna, och om skillnaderna mellan kvinnor och män har sakliga skäl.` });
    }
    if (pb.konsgap) {
    delar.push({ typ: 'rubrik', niva: 3, text: `Löneskillnader inom likvärdigt arbete, per ${per}` });
    delar.push(stycke('Medellön för alla, män och kvinnor i varje BAS-intervall, kvinnors medellön i procent av mäns, andel kvinnor och medelålder. Könsuppdelade mått visas bara där båda könen når minsta gruppstorlek.', 'dampad'));
    delar.push({ typ: 'tabell', kolumner: [{ rubrik: 'BAS', typ: 'text' }, { rubrik: 'Antal', typ: 'antal' }, { rubrik: 'Medellön alla', typ: 'kr' }, { rubrik: 'Medellön män', typ: 'kr' }, { rubrik: 'Medellön kvinnor', typ: 'kr' },
        { rubrik: 'Kvinnors medellön i % av mäns', typ: 'pct1' }, { rubrik: 'Andel kvinnor', typ: 'pct1' }, { rubrik: 'Medelålder alla', typ: 'ar' }, { rubrik: 'Medelålder män', typ: 'ar' }, { rubrik: 'Medelålder kvinnor', typ: 'ar' }],
        rader: pb.konsgap.rader.map(r => [r.bas, r.n, r.medel, r.medelMa, r.medelKv, r.kvot, r.andelKv, r.alder, r.alderMa, r.alderKv]) });
    }
    if (pb.aldersgrupper) {
    delar.push({ typ: 'rubrik', niva: 3, text: `Löneskillnader i åldersgrupper, per ${per}` });
    delar.push(stycke(`Medellön i åldersgrupperna ${pb.aldersgrupper.grupper.join(', ')} år. En åldersgrupp med färre än ${k} personer i intervallet får ingen medellön.`, 'dampad'));
    delar.push({ typ: 'tabell', kolumner: [{ rubrik: 'BAS', typ: 'text' }, { rubrik: 'Antal', typ: 'antal' }, { rubrik: 'Medelålder', typ: 'ar' }, { rubrik: 'Medellön alla', typ: 'kr' },
        ...pb.aldersgrupper.grupper.map(g => ({ rubrik: `Medellön ${g} år`, typ: 'kr' }))],
        rader: pb.aldersgrupper.rader.map(r => [r.bas, r.n, r.alder, r.medel, ...r.perGrupp]) });
    delar.push({ typ: 'fyllIn', text: 'Bedömning: hur lönen utvecklas med åldern i organisationen, och om löneutvecklingen för äldre medarbetare avstannar.' });
    }
    return { id: 'perbas', numrerad: true, rubrik: pb.dim === 'sektor' ? 'Lönestruktur per sektor' : 'Lönestruktur per BAS-intervall', utelamnat, delar };
}

/**
 * Avsnittet Egna tabeller (ADR-52): tabeller användaren byggt i Utforska och lagt till i rapporten. Recepten
 * (state.rapportTabeller) ritas om här med samma pivot som fliken och tröskeln k; inga tal lagras.
 * @param {any[]} d
 * @param {number} k
 */
function rmEgnaAvsnitt(d, k) {
    const recept = state.rapportTabeller || [];
    if (!recept.length || !d.length || typeof _trTabeller !== 'function') return null;
    const stycke = (text, stil) => ({ typ: 'stycke', text, ...(stil ? { stil } : {}) });
    /** @type {any[]} */
    const delar = [stycke('Tabeller som byggts i fliken Utforska och lagts till i rapporten. De räknas på samma underlag och med samma minsta gruppstorlek som rapporten i övrigt.', 'dampad')];
    const utelamnat = [];
    let antal = 0;
    for (const r of recept) {
        const tabeller = _trTabeller(d, r, { k });
        if (!tabeller.length) { utelamnat.push(`tabellen "${r.namn}" (ingen grupp når minsta gruppstorlek)`); continue; }
        for (const t of tabeller) {
            antal++;
            delar.push({ typ: 'rubrik', niva: 3, text: t.rubrik });
            delar.push({ typ: 'tabell', kolumner: t.kolumner, rader: t.rader });
            if (t.not) delar.push(stycke(t.not, 'not'));
            if (t.utelamnade) utelamnat.push(`${t.utelamnade} ${t.utelamnade === 1 ? 'grupp' : 'grupper'} i "${t.rubrik}" (färre än ${k} personer)`);
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
function rapportModell(...a) { return medExportLage(() => _rapportModellExport.apply(null, /** @type {any} */ (a))); }
/** Modellen i det gällande urvalet och med alla avsnitt ur ett enda bygge (det kostar sekunder på stora underlag). */
function rapportModellBada() { return medExportLage(() => _rapportModellExport({ bada: true })); }
/** @param {{alla?: boolean, bada?: boolean}} [val] */
function _rapportModellExport({ alla = false, bada = false } = {}) {
    const d = getData();
    const year = new Date().getFullYear(), today = new Date().toLocaleDateString('sv-SE');
    const k = kTroskel();
    const urval = 'Hela organisationen';
    const arKv = r => r.kon.includes('kvinna'), arMa = r => r.kon === 'man' || r.kon === 'män';
    const kvN = d.filter(arKv).length, maN = d.filter(arMa).length;
    const konOk = _konFarRedovisas(kvN, maN);
    const medKv = Stat.median(d.filter(arKv).map(r => r.lon)), medMa = Stat.median(d.filter(arMa).map(r => r.lon));
    const reg = typeof runOLSRegression === 'function' ? runOLSRegression() : null;
    const prioRef = /** @type {HTMLInputElement} */ (document.querySelector('input[name="prio-ref"]:checked'))?.value || 'stallningstagande';
    const prio = (state.policy.length || state.statistik.length) && typeof computePrioritization === 'function' ? computePrioritization(prioRef) : [];
    const flaggade = prio.filter(i => i.status === 'akut' || i.status === 'atgard');
    const lvRes = typeof computeLikvardighetPairs === 'function' ? likvardighetResultat() : null;
    const { par, utelamnade: parUtelamnade, not: parNot } = _parForRedovisning(lvRes && lvRes.pairs);   // som rapportunderlaget
    const rep = typeof _stRepresentationByBas === 'function' ? (_stRepresentationByBas(d, { k }) || []) : [];
    const repVisade = rep.filter(g => !isKMasked(g.n)), repDolda = rep.filter(g => isKMasked(g.n)).map(g => g.bas);
    const dq = typeof bedomningUnderlag === 'function' ? bedomningUnderlag({ reg }) : null;
    const stycke = (text, stil) => ({ typ: 'stycke', text, ...(stil ? { stil } : {}) });
    const dampad = text => stycke(text, 'dampad');
    const fyllIn = text => ({ typ: 'fyllIn', text });
    const diagram = avsnitt => RM_DIAGRAM.filter(g => g.avsnitt === avsnitt && (!g.kraverAllaPar || (par.length > 0 && !parUtelamnade)) && (!g.om || g.om()))
        .flatMap(g => { const not = g.metodNot ? g.metodNot() : null;
            return [{ typ: 'diagram', id: g.id, flik: g.flik, rubrik: g.rubrik }, ...(not ? [dampad(not)] : [])]; });

    // ---- 1. Sammanfattning och underlag ----
    /** @type {{id: string, rubrik: string, utelamnat: string[], delar: any[], [k: string]: any}} */
    const sammanfattning = { id: 'sammanfattning', numrerad: true, rubrik: 'Sammanfattning och underlag', utelamnat: konOk ? [] : [_konUtelamnatNot()], delar: [
        { typ: 'tabell', nyckel: true, kolumner: [{ rubrik: '', typ: 'text' }, { rubrik: '', typ: 'text' }], rader: [
            ['Antal anställda', `${d.length} (kvinnor: ${kvN}, män: ${maN})`],
            ['Medianlön kvinnor / män', konOk ? `${rmCell(medKv, 'kr')} / ${rmCell(medMa, 'kr')}` : _konUtelamnatNot()],
            ...(konOk && medMa > 0 ? [['Kvinnors medianlön i procent av mäns', svPct(medKv / medMa * 100, 1)]] : []),
            ['Urval', urval],
            ['Referens för lönenivåer', `${referensNamn()}${referensKalla()}`],
            ['Jämförelsestatistik', statistikBeskrivning()],
            ['Rättslig ram', 'Diskrimineringslagen 3 kap. (lönekartläggning); direktiv (EU) 2023/970'],
        ] },
        fyllIn('Sammanfattande slutsats av årets lönekartläggning (övergripande iakttagelser och viktigaste åtgärder).'),
    ] };

    // ---- 2. Regler och praxis ----
    /** @type {{id: string, rubrik: string, utelamnat: string[], delar: any[], [k: string]: any}} */
    const regler = { id: 'regler', numrerad: true, rubrik: 'Regler och praxis kring lön', utelamnat: [], delar: [
        dampad('Granskning av de regler och den praxis som styr lönesättningen — inte lönerna i sig. En regel kan vara könsneutralt skriven och ändå slå olika i praktiken. Redovisas per granskningsområde.'),
    ] };
    if (repVisade.length >= 2) {   // bara BAS som får redovisas rangordnas efter median och namnges
        const sorterade = [...repVisade].sort((a, b) => b.median - a.median), topp = sorterade[0], botten = sorterade[sorterade.length - 1];
        if (botten.andelKv - topp.andelKv > 15) regler.delar.push(stycke(`Automatisk iakttagelse: andelen kvinnor är högre i lägre betalda BAS-nivåer (${botten.bas}: ${svPct(botten.andelKv, 0)}) än i högre betalda (${topp.bas}: ${svPct(topp.andelKv, 0)}) — det kan tyda på att kvinnor och män är ojämnt fördelade mellan nivåerna, vilket är värt att beakta i granskningen av regler och praxis.`));
    }
    const bes8 = typeof _bes8Areas === 'function' ? _bes8Areas() : [];
    if (bes8.length) {
        regler.delar.push({ typ: 'tabell', kolumner: [{ rubrik: 'Granskningsområde', typ: 'text' }, { rubrik: 'Bedömning', typ: 'fyllIn' }, { rubrik: 'Iakttagelser / åtgärd', typ: 'fyllIn' }],
            rader: bes8.map(a => [a.title, a.status || { text: '[HR fyller i]', fyllIn: true }, a.note || { text: '[HR fyller i]', fyllIn: true }]) });
        regler.delar.push(dampad('Bedömningen fylls i på fliken "Bestämmelser & praxis" och följer automatiskt med hit.'));
    } else {
        regler.delar.push(fyllIn('Granska lönekriterier och hur de tillämpas; lönesättning vid nyanställning, lönerevision och efter föräldraledighet; samt om någon bestämmelse eller praxis kan missgynna ett kön. Beskriv iakttagelser och eventuella åtgärder.'));
    }

    // ---- 3. Lika arbete ----
    /** @type {{id: string, rubrik: string, utelamnat: string[], delar: any[], [k: string]: any}} */
    const lika = { id: 'lika', numrerad: true, rubrik: 'Lika arbete — kvinnor och män i samma yrke', utelamnat: [], delar: [
        dampad('Den löneskillnad som står kvar när ålder och nivå räknats bort, samt de yrkesgrupper där kvinnors och mäns medianlön skiljer sig mer än 5 % och därför behöver förklaras med sakliga skäl eller åtgärdas.'),
        dampad(AID_METODTEXT),
    ] };
    if (reg && !reg.error) {
        lika.delar.push({ typ: 'tabell', nyckel: true, kolumner: [{ rubrik: '', typ: 'text' }, { rubrik: '', typ: 'text' }], rader: [
            // Det råa gapet är ett beskrivande könsuppdelat mått och följer tröskeln (_raGapText).
            ['Kvinnors medianlön i procent av mäns', _raGapText(reg, v => rmAndelAvMan(v, 1))],
            ['Löneskillnad som står kvar efter ålder och nivå', { text: `${rmCell(reg.konPct, 'tecken2')} (95 % KI: ${svTal(reg.konPctLow, 2)} till ${svPct(reg.konPctHigh, 2)}; ${_formatPValue(reg.pValue)})`, fet: true }],
            ['Modell', `log(lön) ~ ${reg.modelDesc} · ${reg.n} obs · R² ${svPct(reg.R2 * 100, 1)}`],
        ] });
        lika.delar.push(dampad('Löneskillnaden efter ålder och nivå anges som en skillnad i procent: negativ när kvinnor ligger lägre.'));
    } else {
        lika.delar.push(dampad('Underlaget räcker inte för att räkna fram den justerade löneskillnaden.'));
    }
    lika.delar.push(...diagram('lika'));
    lika.delar.push({ typ: 'rubrik', niva: 3, text: 'Grupper att bedöma' });
    // Samma grupper som fliken Lika arbete och rapportunderlaget: yrkesgrupper där kvinnors och mäns medianlön skiljer
    // sig mer än 5 %, med tröskeln för varje kön. Grupper under referensen står i avsnittet om åtgärder.
    const likaGr = _ruLikaArbeteGrupper(d, { k, troskel: 5 });
    const attBedoma = likaGr.grupper.filter(g => g.flaggad);
    if (attBedoma.length) {
        lika.delar.push({ typ: 'tabell', kolumner: [{ rubrik: 'Yrkesgrupp', typ: 'text' }, { rubrik: 'Kvinnor / män', typ: 'text' }, { rubrik: 'Median kvinnor', typ: 'kr' }, { rubrik: 'Median män', typ: 'kr' },
            { rubrik: 'Kvinnors median i % av mäns', typ: 'pct1' }, { rubrik: 'Saklig förklaring (fyll i)', typ: 'fyllIn' }, { rubrik: 'Åtgärd/beslut (fyll i)', typ: 'fyllIn' }],
            rader: attBedoma.slice(0, 30).map(g => [g.yrke, `${g.nKv} / ${g.nMa}`, g.medKv, g.medMa, g.kvot * 100, '', '']) });
        if (attBedoma.length > 30) lika.utelamnat.push(`${attBedoma.length - 30} yrkesgrupper utöver de 30 första`);
    } else {
        lika.delar.push(dampad('Ingen yrkesgrupp har en skillnad över 5 % mellan kvinnors och mäns medianlön.'));
    }
    const likaSma = likaGr.utelamnade.length + likaGr.grupper.filter(g => g.samladMedian).length;
    if (likaSma) lika.utelamnat.push(`könsjämförelsen för ${likaSma} ${likaSma === 1 ? 'yrkesgrupp' : 'yrkesgrupper'} där ett kön har färre än ${k} personer`);
    lika.delar.push(fyllIn('Bedöm för varje grupp om löneskillnaden har samband med kön. Ange sakligt skäl (t.ex. dokumenterad erfarenhet, prestation, marknadsläge, tjänstetillägg) eller besluta åtgärd.'));

    // ---- 4. Likvärdigt arbete ----
    /** @type {{id: string, rubrik: string, utelamnat: string[], delar: any[], [k: string]: any}} */
    const likvardigt = { id: 'likvardigt', numrerad: true, rubrik: 'Likvärdigt arbete — kvinnodominerade yrken', utelamnat: [], delar: [
        dampad('Kvinnodominerade yrken som tjänar mindre än ett annat yrke med minst lika höga krav. Listan är kandidater att granska — det är arbetsgivaren som avgör om kraven verkligen är likvärdiga.'),
    ] };
    const medNamn = (aid, namn, bas) => `${aid}${namn && namn !== aid ? ' ' + namn : ''} (BAS ${bas})`;
    if (par.length) {
        likvardigt.delar.push({ typ: 'tabell', kolumner: [{ rubrik: '#', typ: 'antal' }, { rubrik: 'Kvinnodominerat yrke', typ: 'text' }, { rubrik: 'Jämförelseyrke', typ: 'text' },
            { rubrik: 'Jämförelseyrkets median högre med (kr)', typ: 'kr' }, { rubrik: 'Högre med (%)', typ: 'pct1' }, { rubrik: 'Kravvärdering / sakligt skäl (fyll i)', typ: 'fyllIn' }],
            rader: par.slice(0, 25).map((p, i) => [i + 1, medNamn(p.kvAid, p.kvLabel, p.kvBas), medNamn(p.maAid, p.maLabel, p.maBas), p.gapKr, p.gapPct, '']) });
        if (par.length > 25) likvardigt.utelamnat.push(`${par.length - 25} par utöver de 25 första`);
    } else if (!parNot) {
        likvardigt.delar.push(dampad('Inga jämförelsepar hittades. Antingen är grupperna för små för att redovisas, eller så ligger inget kvinnodominerat yrke lägre än sin jämförelse.'));
    }
    if (parNot) { likvardigt.delar.push(dampad(parNot)); likvardigt.utelamnat.push(`${parUtelamnade} kandidatpar med en grupp under ${k} personer`); }
    likvardigt.delar.push(...diagram('likvardigt'));
    likvardigt.delar.push(fyllIn('Avgör, utifrån befattningsbeskrivning eller arbetsvärdering, om jämförelseyrkets krav verkligen är likvärdiga eller lägre. Ange sakligt skäl eller åtgärd för varje par som står kvar.'));

    // ---- 5. Struktur och lönetransparens ----
    // Lönemåtten (median, lönegapet per BAS) redovisas bara för BAS-intervall med minst tröskeln personer.
    // Gapet per BAS står med direktivets tecken (rmDirektivGap), som i EU-lönerapportens blad; översikten från Lika
    // arbete längre ned behåller flikens form (kvinnors lön i procent av mäns med konfidensintervall).
    const repNot = [_rmNotText(kMaskNote(repDolda, 'BAS-intervall|BAS-intervall')), _rmNotText(kSamladNote(repVisade.filter(g => g.konLitet).map(g => g.bas), 'BAS-intervall|BAS-intervall'))].filter(Boolean);
    const oversikt = typeof _laOversiktRader === 'function' ? _laOversiktRader(d, undefined, k) : [];
    const struktur = (repVisade.length || repNot.length) ? { id: 'struktur', numrerad: true, rubrik: 'Struktur och lönetransparens (EU 2023/970)',
        utelamnat: [...(repDolda.length ? [`BAS ${repDolda.join(', ')} (färre än ${k} personer)`] : []),
            ...(repVisade.some(g => g.konLitet) ? [`könsuppdelade lönemått för BAS ${repVisade.filter(g => g.konLitet).map(g => g.bas).join(', ')} (ett kön har färre än ${k} personer)`] : [])], delar: [
            dampad('Hur kvinnor och män fördelar sig mellan nivåerna, och lönegapet i median på varje nivå enligt direktivets art. 9: skillnaden i procent av mäns lön, positivt tal = kvinnor lägre. Verktygets flikar visar samma skillnad som kvinnors lön i procent av mäns.'),
            ...(repVisade.length ? [{ typ: 'tabell', kolumner: [{ rubrik: 'BAS', typ: 'text' }, { rubrik: 'N', typ: 'antal' }, { rubrik: 'Andel kvinnor', typ: 'pct0' }, { rubrik: 'Median', typ: 'kr' }, { rubrik: RM_DIREKTIV_RUBRIK, typ: 'direktiv' }],
                rader: repVisade.map(g => [g.bas, g.n, g.andelKv, g.median, g.gapPct == null ? null : g.gapPct]) }] : []),
            ...repNot.map(t => stycke(t, 'not')),
            // Samma översikt som fliken Lika arbete öppnar med: en rad per BAS-intervall där båda könen når tröskeln,
            // ur samma beräkning (_laOversiktRader). Kvoten med sitt konfidensintervall och status står i ord — i
            // Word och PDF finns ingen grafik i raden; bilden under tabellen visar samma kvot.
            ...(oversikt.length ? [{ typ: 'rubrik', niva: 3, text: 'Kvinnors och mäns lön per BAS-intervall' },
                { typ: 'tabell', kolumner: [{ rubrik: 'BAS', typ: 'text' }, { rubrik: 'Kvinnor / män', typ: 'text' }, { rubrik: 'Median kvinnor', typ: 'kr' }, { rubrik: 'Median män', typ: 'kr' },
                    { rubrik: 'Skillnad', typ: 'text' }, { rubrik: 'Kvinnors lön i % av mäns', typ: 'pct1' }, { rubrik: '95 % konfidensintervall', typ: 'text' }, { rubrik: 'Status', typ: 'text' }],
                  rader: oversikt.map(o => { const skillnad = Math.round(o.medKv) - Math.round(o.medMa);
                      return [o.bas, `${o.nKv} / ${o.nMa}`, o.medKv, o.medMa, `${skillnad < 0 ? '−' : skillnad > 0 ? '+' : ''}${rmCell(Math.abs(skillnad), 'kr')}`, o.gap,
                              o.ci ? `${svTal(o.ci.lo, 1)}–${svPct(o.ci.hi, 1)}` : '—', _laOversiktStatus(o).serie]; }) },
                dampad('Skillnaden är kvinnors medianlön minus mäns. Når konfidensintervallet 100 % kan skillnaden bero på slumpen. Bara BAS-intervall där både kvinnor och män når minsta gruppstorlek har en rad.')] : []),
            ...diagram('struktur'),
        ] } : null;

    // ---- Lönestruktur per BAS-intervall (tabellerna ur arbetsgivarnas egna utkast) ----
    const perbas = rmPerBasAvsnitt(d, k);
    const egna = rmEgnaAvsnitt(d, k);

    // ---- 6. Åtgärder och tidsplan ----
    /** @type {{id: string, rubrik: string, utelamnat: string[], delar: any[], [k: string]: any}} */
    const atgarder = { id: 'atgarder', numrerad: true, rubrik: 'Åtgärder och tidsplan', utelamnat: [], delar: [
        dampad('Planerade lönejusteringar och andra åtgärder, med beslut, ansvar och tidsplan. Tabellen listar de grupper som ligger under referensen enligt prioriteringen, med uppskattad kostnad för att nå den.'),
        flaggade.length
            ? { typ: 'tabell', kolumner: [{ rubrik: 'Grupp', typ: 'text' }, { rubrik: 'Uppskattad kostnad', typ: 'krAr' }, { rubrik: 'Beslutad åtgärd (fyll i)', typ: 'fyllIn' }, { rubrik: 'Ansvarig (fyll i)', typ: 'fyllIn' }, { rubrik: 'Klart senast (fyll i)', typ: 'fyllIn' }],
                rader: flaggade.slice(0, 20).map(it => [`${it.yrke} (BAS ${it.bas})`, it.annualGapTotal ? Math.round(it.annualGapTotal) : null, '', '', '']) }
            : dampad('Inga prioriterade åtgärdsgrupper (ingen referensdata uppladdad).'),
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
    // och den förklarade andelen följer tröskeln (_regStegForRedovisning, ADR-12).
    const nyckel = rader => ({ typ: 'tabell', nyckel: true, kolumner: [{ rubrik: '', typ: 'text' }, { rubrik: '', typ: 'text' }], rader });
    const utanTaggar = t => String(t).replace(/<[^>]+>/g, '');
    /** @type {{id: string, rubrik: string, utelamnat: string[], delar: any[], [k: string]: any}} */
    const regression = { id: 'regression', rubrik: 'Bilaga: Justerat lönegap i detalj', utelamnat: [], delar: [] };
    if (reg && !reg.error) {
        const stegUt = _regStegForRedovisning(reg);
        const kritisk = reg.pValue < 0.05 && Math.abs(reg.konPct) > 5;
        regression.delar.push(
            dampad(`Skattad modell: log(lön) ~ ${reg.modelDesc} (OLS-regression). Lönegapet anges som en skillnad i procent: negativ när kvinnor ligger lägre.`),
            nyckel([
                ['Antal observationer', `${reg.n} (kvinnor: ${reg.nKvAnalysed}, män: ${reg.nMaAnalysed})`],
                ['Kvinnors medianlön i procent av mäns', _raGapText(reg, v => rmAndelAvMan(v, 1))],
                [`Oförklarad skillnad${kritisk ? ' (över 5 % och statistiskt säkerställd)' : ''}`, { text: `${rmCell(reg.konPct, 'tecken2')} (95 % KI: ${svTal(reg.konPctLow, 2)} till ${svTal(reg.konPctHigh, 2)}, ${_formatPValue(reg.pValue)}, t = ${svTal(reg.tStat, 2)}; HC3 robust SE)`, fet: true }],
                ['Ålderseffekt', `${rmCell(reg.ageEffect, 'tecken2')} per år`],
                ['R² / justerad R²', `${svPct(reg.R2 * 100, 1)} / ${svPct(reg.adjR2 * 100, 1)}`],
                ['BAS-intervall i modellen', `${reg.nBas} (${reg.basList[0]}–${reg.basList[reg.basList.length - 1]}; indikatorvariabler, ${reg.basRef} är referens)`],
                ...(reg.basEffekter ? [['BAS-effekter', `nivå mot BAS ${reg.basRef}: ${reg.basEffekter.map(e => `${e.bas} ${rmCell(e.pct, 'tecken2')} (${_formatPValue(e.p)})`).join('; ')}`]] : []),
            ]));
        if (reg.fellBackFromFull && reg.diagnostics.length) regression.delar.push(stycke(`Notering: fullmodellen kunde inte skattas. Föll tillbaka till ${reg.modelDesc}. ${reg.diagnostics.map(utanTaggar).join(' ')}`));
        regression.delar.push({ typ: 'rubrik', niva: 3, text: 'Sekventiell dekomponering' },
            { typ: 'tabell', kolumner: [{ rubrik: 'Modell', typ: 'text' }, { rubrik: 'Lönegap', typ: 'tecken2' }, { rubrik: 'R²', typ: 'pct1' }],
              rader: stegUt.steg.map(st => (st.status !== 'ok' ? [st.name, { text: st.status === 'singular' ? 'singulär' : 'för få obs' }, null] : [st.name, st.gapPct, st.R2 * 100])) });
        if (reg.yrkesSteg?.status === 'ok') regression.delar.push(stycke(`Steget + Yrkesgrupp: ${utanTaggar(_yrkesStegText(reg.yrkesSteg))}`));
        if (stegUt.utelamnat) { regression.delar.push(stycke(stegUt.not, 'not')); regression.utelamnat.push('första steget i dekomponeringen (ett kön under tröskeln)'); }
        else if (stegUt.explainedShare !== null) regression.delar.push(stycke(`Strukturellt förklarad andel: ${svPct(stegUt.explainedShare, 0)} av råa gapet förklaras av strukturella variabler (ålder och BAS-intervall). Oförklarad rest: ${svPct(100 - stegUt.explainedShare, 0)}.`));
        const perBas = (reg.perBas || []).filter(pb => pb.status === 'ok');
        if (perBas.length) regression.delar.push({ typ: 'rubrik', niva: 3, text: 'Per BAS-intervall (separata regressioner)' },
            { typ: 'tabell', kolumner: [{ rubrik: 'BAS', typ: 'text' }, { rubrik: 'N', typ: 'antal' }, { rubrik: 'Kvinnor / män', typ: 'text' }, { rubrik: 'Oförklarat gap', typ: 'tecken2' }, { rubrik: 'Signifikans', typ: 'text' }, { rubrik: 'Över 5 % och säkerställd', typ: 'text' }],
              rader: perBas.map(pb => [pb.bas, pb.n, `${pb.kvN} / ${pb.maN}`, pb.gapPct, _formatPValue(pb.pValue), pb.pValue < 0.05 && Math.abs(pb.gapPct) > 5 ? 'ja' : '']) });
    } else if (reg && reg.error) {
        regression.delar.push(stycke(reg.error));
        const forsok = (reg.triedSteps || []).map(st => `${st.desc || st.name}${st.status === 'ok' ? '' : st.status === 'singular' ? ' (multikollinearitet)' : st.status === 'too_few' ? ' (för få obs)' : ''}`);
        if (forsok.length) regression.delar.push(dampad(`Försökta modellspecifikationer: ${forsok.join('; ')}.`));
        if ((reg.diagnostics || []).length) regression.delar.push(dampad(`Identifierade orsaker: ${reg.diagnostics.map(utanTaggar).join(' ')}`));
    }
    const regressionAvsnitt = regression.delar.length ? regression : null;

    /** @type {{id: string, rubrik: string, utelamnat: string[], delar: any[], [k: string]: any}} */

    const metod = { id: 'metod', rubrik: 'Bilaga: Metod och parametrar', utelamnat: [], delar: [
        dampad('Dessa uppgifter följer med så att analysen går att återskapa och förstå. Verktyget pekar ut kandidater för bedömning — det dömer inte.'),
        { typ: 'tabell', nyckel: true, kolumner: [{ rubrik: '', typ: 'text' }, { rubrik: '', typ: 'text' }], rader: (typeof _methodAppendixData === 'function' ? _methodAppendixData() : []).map(([n, v]) => [String(n), String(v)]) },
    ] };

    const finns = /** @type {any[]} */ ([sammanfattning, regler, lika, likvardigt, struktur, perbas, atgarder, samverkan, beslut, regressionAvsnitt, metod].filter(Boolean));
    /** @param {boolean} alla */
    const avsnitt = alla => {
        const urval = rapportUrval();
        const valda = /** @type {any[]} */ (alla ? finns : urval.med.map(id => finns.find(a => a.id === id)).filter(Boolean));
        // Egna tabeller (ADR-52) står efter avsnittet per BAS-intervall och följer med när det gör det; de väljs i stället
        // genom att tabeller läggs till eller tas bort under Dokumentera & exportera.
        if (egna && (alla || urval.med.includes('perbas'))) { const i = valda.findIndex(a => a.id === 'perbas'); valda.splice(i >= 0 ? i + 1 : valda.length, 0, egna); }
        let nr = 0;
        return valda.map(a => ({ ...a, grundrubrik: a.rubrik, rubrik: a.numrerad ? `${++nr}. ${a.rubrik}` : a.rubrik }));
    };
    const modell = alla => ({
        titel: `Lönekartläggning ${year} — dokumentation`,
        undertitel: `${orgNamn('') || '[HR fyller i: organisation/arbetsgivare]'} · ${urval} · genererad ${today} · v${APP_VERSION}${dq ? ` · Underlagets kvalitet: ${UK_ETIKETT[dq.status]}` : ''}`,
        demo: !!state.isDemo,
        avsnitt: avsnitt(alla),
        urval: rapportUrval().namn,
    });
    return bada ? { urval: modell(false), alla: modell(true) } : modell(alla);
}

/**
 * Modellen som HTML: samma klasser som utkastet har haft (`muted`, `fillin`, `draftbox`), så att omvandlingen till
 * Word-block (_utkastTillBlock) och utskriften kan läsa den. Ett diagram blir en <figure data-rm-bild="id">.
 */
/**
 * @param {any} m
 * @param {{utskrift?: boolean, bilder?: Map<string, {url: string, alt: string}>|null}} [opts]
 */
function rmTillHtml(m, { utskrift = false, bilder = null } = {}) {
    if (!m || !m.avsnitt.length) return '';
    const cell = (v, typ) => {
        const t = esc(rmCell(v, typ));
        if (v && typeof v === 'object' && v.fyllIn) return `<em>${t}</em>`;
        if (v && typeof v === 'object' && v.fet) return `<strong>${t}</strong>`;
        return t || '&nbsp;';
    };
    const del = p => {
        if (p.typ === 'stycke') return `<p${p.stil === 'dampad' ? ' class="muted"' : p.stil === 'not' ? ' class="k-mask-note"' : ''}>${esc(p.text)}</p>`;
        if (p.typ === 'fyllIn') return `<div class="fillin"><strong>[HR fyller i]</strong> ${esc(p.text)}</div>`;
        if (p.typ === 'rubrik') return `<h${p.niva}>${esc(p.text)}</h${p.niva}>`;
        if (p.typ === 'diagram') {
            if (!utskrift) return `<figure data-rm-bild="${esc(p.id)}" data-rm-flik="${esc(p.flik)}"><figcaption>${esc(p.rubrik)}</figcaption></figure>`;
            const b = bilder && bilder.get(p.id);   // ett diagram utan bild (inte ritat) följer inte med i utskriften
            return b ? `<figure class="rm-bild"><img src="${b.url}" alt="${esc(b.alt)}"><figcaption>${esc(p.rubrik)}</figcaption></figure>` : '';
        }
        if (p.typ === 'tabell') {
            if (p.nyckel) return `<table>${p.rader.map(r => `<tr><th>${esc(rmCell(r[0], 'text'))}</th><td>${cell(r[1], p.kolumner[1].typ)}</td></tr>`).join('')}</table>`;
            return `<table><thead><tr>${p.kolumner.map(c => `<th>${esc(c.rubrik)}</th>`).join('')}</tr></thead><tbody>`
                + p.rader.map(r => `<tr>${r.map((v, i) => `<td>${cell(v, p.kolumner[i].typ)}</td>`).join('')}</tr>`).join('') + '</tbody></table>';
        }
        return '';
    };
    // En klass, inget style-attribut: utskriftsrapporten ligger i verktygets dokument och Word-vägen tolkas med DOMParser, som ärver
    // CSP:n (style-src-attr 'none'). Word-utkastet läser rutan på klassen draftbox; färgerna för PDF-rapporten står i stilmallen.
    const demo = m.demo ? `<div class="draftbox draftbox-demo"><strong>DEMODATA</strong> — ${utskrift ? 'denna rapport' : 'detta utkast'} bygger på syntetisk exempeldata och är INTE en verklig lönekartläggning.</div>` : '';
    const ruta = utskrift
        ? '<div class="draftbox"><strong>Låst kopia.</strong> Samma innehåll som Word-utkastet vid samma tillfälle, att verifiera mot. Fälten märkta <em>[HR fyller i …]</em> fylls i och beslutas i Word-dokumentet.</div>'
        : '<div class="draftbox"><strong>⚠ UTKAST att färdigställa.</strong> Verktygets analysfynd är ifyllda nedan. De gulmarkerade <em>[HR fyller i …]</em>-fälten är de kvalitativa bedömningar som Diskrimineringslagen ålägger arbetsgivaren att göra och dokumentera. Granska alla siffror, fyll i bedömningarna, och spara som <strong>.docx</strong> när dokumentet är klart. Detta utkast ersätter inte er slutliga, beslutade dokumentation.</div>';
    const avsnitt = a => `<h2>${esc(a.rubrik)}</h2>${a.delar.map(del).join('')}`;
    return demo + `<h1>${esc(m.titel)}</h1><p class="muted">${esc(m.undertitel)}</p>` + ruta
        + m.avsnitt.map(a => (utskrift ? `<section class="rm-avsnitt" data-rm-avsnitt="${esc(a.id)}">${avsnitt(a)}</section>` : avsnitt(a))).join('');
}

/** Vad en export ur modellen kommer att innehålla och utelämna — underlaget till förhandsbeskedet. */
function rmBesked(m) {
    const delar = m.avsnitt.flatMap(a => a.delar);
    return { avsnitt: m.avsnitt.length, tabeller: delar.filter(p => p.typ === 'tabell').length, diagram: delar.filter(p => p.typ === 'diagram').length,
        fyllIn: delar.filter(p => p.typ === 'fyllIn').length, utelamnat: m.avsnitt.flatMap(a => a.utelamnat || []), urval: m.urval };
}

/**
 * Bilden till en diagramdel, som data-URL (PNG). Fliken som äger diagrammet ritas först (utan att visas), och bilden
 * görs ur figuren på samma väg som diagrammens egna exportknappar — utan små grupper och med meningen om sänkt
 * tröskel. Null när diagrammet inte ritas (underlaget når inte tröskeln) eller bilden inte går att göra.
 */
const RM_BILD = { bredd: 1400, hojd: 620 };
async function rmDiagramBild(del, ritade = new Set()) {
    try {
        if (del.flik && !ritade.has(del.flik)) { ritade.add(del.flik); try { renderTabContent(del.flik); } catch (_e) { /* diagrammet är då inte ritat */ } }
        const el = document.getElementById(del.id);
        if (!el || !diagramRitat(el)) return null;
        const url = String(await diagramTillBild(el, { ...RM_BILD, utanRubrik: true }));
        if (!/^data:image\/png/.test(url) || !url.split(',')[1]) return null;
        return { url, base64: url.split(',')[1], alt: el._exportBeskrivning || del.rubrik, ...RM_BILD };
    } catch (_e) { return null; }
}

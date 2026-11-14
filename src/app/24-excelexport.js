// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Excel-export: alla flikar och JPA-protokollet (EU 2023/970 art. 10) ----
/**
 * Bladen som "Excel (alla flikar)" kommer att innehålla, i ordning — underlaget till exportens förhandsbesked.
 * Listan följer villkoren i _excelAlltBok nedan; ett test håller dem lika.
 */
// Bladlistan räknas som exporten: i exportläget (ADR-51), så att beskedet och arbetsboken får samma blad.
function excelAlltBlad(...a) { return medExportLage(() => _excelAlltBladExport.apply(null, /** @type {any} */ (a))); }
function _excelAlltBladExport() {
    // Bladet Underlagets kvalitet finns när bedomningUnderlag() ger något, alltså när det finns rader; listan räknar
    // inte regressionen för att veta det.
    if (!state.data.length) return [];
    const harRef = state.policy.length > 0 || state.statistik.length > 0;
    return ['Löneöversikt', 'Per BAS', ...((state.rapportTabeller || []).length ? ['Egna tabeller'] : []), 'EU-lönekartläggning', ...(harRef ? ['Prioritering'] : []), 'Löneskillnad', 'Könsskevhet', ..._excelDiagramBlad().map(b => b[0]), ...AIDBAS_BLADNAMN, 'Sektorer',
        ...(state.statistik.length ? ['Jämförelsestatistik'] : []), ...(_excelSkalRader() ? ['Sakliga skäl'] : []), ...(getData().length ? ['Underlagets kvalitet'] : []), 'Metodik', 'Metod & parametrar'];
}

/**
 * Raderna i bladet Sakliga skäl (handlingsplanens skäl per grupp och sammanställningen per kategori), eller null när
 * ingen rad har skäl. Förifyllningen räknas i exportläget, så en grupp under tröskeln följer inte med.
 */
function _excelSkalRader() {
    if (typeof _hpSkalUnderlag !== 'function') return null;
    const { grupper, perKategori: pk } = _hpSkalUnderlag();
    if (!grupper.length) return null;
    const pct = v => (v == null ? '' : Math.round(v * 1000) / 10);
    /** @type {any[][]} */
    const rows = [['Sakliga skäl per grupp', 'Tabellerna visar de sakliga skäl som organisationen har angett per grupp. Beloppet är den del av gruppens medianskillnad, i kronor per månad, som skälet förklarar.'],
        ['Grupp', 'Underlag', 'Antal berörda', 'Medianskillnad (kr/mån)', 'Kategori', 'Belopp (kr/mån)', 'Andel av skillnaden (%)', 'Kommentar']];
    for (const g of grupper) for (const s of g.sammanstallning.skal)
        rows.push([g.grupp, g.underlag, g.antal == null ? '' : g.antal, g.skillnadKr == null ? '' : g.skillnadKr, s.namn,
            g.utanBelopp ? '' : s.belopp, g.utanBelopp ? '' : pct(s.andel), g.utanBelopp ? HP_SKAL_UTAN_BELOPP : (s.kommentar || '')]);
    rows.push([], ['Sammanställning per kategori'], ['Kategori', 'Belopp (kr/mån)', 'Andel av skillnaden i grupper med skäl (%)', 'Antal grupper']);
    for (const k of pk.kategorier) rows.push([k.namn, k.summa, pct(k.andel), k.antalGrupper]);
    rows.push(['Totalt', pk.summa, pct(pk.andel), pk.antalGrupper], [],
        ['Kategorierna och beloppen är organisationens bedömning. Verktyget räknar bara om beloppen till andelar av skillnaden. ' + _ruSkalNot(kInstalld())]);
    return rows;
}

/** Raderna i bladet Egna tabeller, eller null när inga recept finns. Tal som tal, med kolumnrubriken som enhet. */
function _excelEgnaRader() {
    const recept = state.rapportTabeller || [];
    if (!recept.length || typeof _trTabeller !== 'function') return null;
    const tal = (v, typ) => (v == null || typeof v !== 'number' || !isFinite(v) ? (v == null ? '' : v) : (typ === 'kr' || typ === 'antal' ? Math.round(v) : Math.round(v * 100) / 100));
    const rows = [['Egna tabeller', `byggda i Tabeller och egna vyer; minsta gruppstorlek ${kTroskel()}: grupper med färre personer redovisas inte`], []];
    for (const r of recept) {
        const tabeller = _trTabeller(getData(), r, { k: kTroskel() });
        if (!tabeller.length) { rows.push([r.namn, 'ingen grupp når minsta gruppstorlek'], []); continue; }
        for (const t of tabeller) {
            rows.push([t.rubrik, _trBeskrivning(r)]);
            rows.push(t.kolumner.map(c => c.rubrik + (c.typ === 'kr' ? ' (kr/mån)' : c.typ === 'pct1' ? ' (%)' : '')));
            t.rader.forEach(rad => rows.push(rad.map((v, i) => tal(v, t.kolumner[i].typ))));
            if (t.not) rows.push([t.not]);
            rows.push([]);
        }
    }
    return rows;
}

/** Raderna i bladet Per BAS, eller null utan underlag. */
function _excelPerBasRader() {
    const pb = typeof rmPerBasUnderlag === 'function' ? rmPerBasUnderlag(getData(), kTroskel()) : null;
    if (!pb || !pb.intervall.length) return null;
    const tal = v => (v == null || !isFinite(v) ? '' : Math.round(v));
    const pct = v => (v == null || !isFinite(v) ? '' : Math.round(v * 10) / 10);
    const MATT = { p10: 'P10', p25: 'P25', med: 'Median', p75: 'P75', p90: 'P90', medel: 'Medellön' };
    const matt = pb.recept.matt;
    const per = pb.dim === 'sektor' ? 'sektor' : 'BAS-intervall', kort = pb.dim === 'sektor' ? 'Sektor' : 'BAS';
    const rows = [[`Lönestruktur per ${per}`, `minsta gruppstorlek ${pb.k}: grupper med färre personer redovisas inte`], []];
    for (const i of pb.intervall) {
        rows.push([`${kort} ${i.bas}`, `${i.n} anställda, ${i.nKv} kvinnor och ${i.nMa} män, ${i.antalYrken} yrkesgrupper`]);
        rows.push(['Grupp', 'Antal', ...matt.map(m => MATT[m])]);
        i.rader.forEach(r => rows.push([r.namn, r.n == null ? '' : r.n, ...matt.map(m => tal(r[m]))]));
        if (i.utelamnade.length) rows.push([`Redovisas inte (färre än ${pb.k} ${personOrd(pb.k)}): ${i.utelamnade.join(', ')}`]);
        if (!i.konVisas) rows.push([`Kvinnor och män redovisas inte var för sig: ett kön har färre än ${pb.k} ${personOrd(pb.k)}`]);
        rows.push([]);
    }
    if (pb.basUtelamnade.length) rows.push([`${pb.dimEtikett} som inte redovisas (färre än ${pb.k} ${personOrd(pb.k)}): ${pb.basUtelamnade.join(', ')}`], []);
    if (pb.konsgap) {
    // Utan ålder i lönefilen (ADR-64) står medelåldern inte med.
    const medAlder = pb.harAlder !== false;
    rows.push([`Löneskillnader inom likvärdigt arbete, per ${per}`]);
    rows.push(['BAS', 'Antal', 'Medellön alla', 'Medellön män', 'Medellön kvinnor', 'Kvinnors medellön i % av mäns', 'Andel kvinnor (%)', ...(medAlder ? ['Medelålder alla', 'Medelålder män', 'Medelålder kvinnor'] : [])]);
    pb.konsgap.rader.forEach(r => rows.push([r.bas, r.n, tal(r.medel), tal(r.medelMa), tal(r.medelKv), pct(r.kvot), pct(r.andelKv), ...(medAlder ? [tal(r.alder), tal(r.alderMa), tal(r.alderKv)] : [])]));
    rows.push([]);
    }
    if (pb.recept.aldersgrupper && pb.harAlder === false) rows.push(['Löneskillnader i åldersgrupper redovisas inte: lönefilen saknar ålder.']);
    if (pb.aldersgrupper) {
    rows.push([`Löneskillnader i åldersgrupper, per ${per}`]);
    rows.push(['BAS', 'Antal', 'Medelålder', 'Medellön alla', ...pb.aldersgrupper.grupper.map(g => `Medellön ${g} år`)]);
    pb.aldersgrupper.rader.forEach(r => rows.push([r.bas, r.n, tal(r.alder), tal(r.medel), ...r.perGrupp.map(tal)]));
    }
    return rows;
}

/**
 * Talen bakom flikarnas diagram och översiktstabell, som egna blad: det som står i bilden ska gå att räkna vidare på.
 * Samma funktioner som ritar vyerna lämnar raderna, så bladen följer vyernas regler för minsta gruppstorlek — en
 * grupp som inte ritas får ingen rad. Bladen gäller hela organisationen, också när en flik är avgränsad.
 * Sist bladet Lönepolitik (läget i lönespannet per yrkesgrupp och per kön), när ett ställningstagande är inläst, och
 * bladet Referenser (löneläget och statistiken mot ställningstagandet), när minst en referens är inläst.
 * @returns {[string, any[][]][]} bladets namn och rader
 */
function _excelDiagramBlad() {
    const d = getData(), k = kTroskel(), ut = [], r1 = v => Math.round(v * 10) / 10;
    const bas = _laOversiktRader(d);
    if (bas.length) ut.push(['Lika arbete per BAS', [
        ['Kvinnors och mäns lön per BAS-intervall (översiktstabellen i Lönestruktur)'], [],
        ['BAS-intervall', 'Antal kvinnor', 'Antal män', 'Median kvinnor (kr)', 'Median män (kr)', 'Skillnad (kr)', 'Kvinnors median i % av mäns', 'Konfidensintervall 95 %, nedre', 'Konfidensintervall 95 %, övre', 'Status', _STS_DIR_KOLUMN],
        ...bas.map(o => [o.bas, o.nKv, o.nMa, Math.round(o.medKv), Math.round(o.medMa), Math.round(o.medKv - o.medMa), r1(o.gap), o.ci ? r1(o.ci.lo) : '', o.ci ? r1(o.ci.hi) : '', _laOversiktStatus(o).serie, _stsDirektiv(o.gap) ? _STS_DIR_ETIKETT : '']),
        [], [`Status: Värt att granska = konfidensintervallet utesluter 100 % och skillnaden är minst 3 % (verktygets storleksgräns). ${_STS_DIR_KOLUMN}: ${_STS_DIR_TIPS}`]]]);
    const tratt = _laTrattUnderlag(d);
    if (tratt) ut.push(['Slumpens gränser', [
        ['Yrkesgrupperna mot slumpens gränser (trattdiagrammet på Lika arbete)'],
        [`En rad per yrkesgrupp och BAS-intervall där både kvinnor och män är minst ${k}. Gränserna är de 95-procentiga för gruppens storlek.`], [],
        ['Yrkesgrupp', 'BAS-intervall', 'Antal kvinnor', 'Antal män', 'Kvinnors median i % av mäns', 'Gräns, nedre', 'Gräns, övre', 'Bedömning'],
        ...tratt.punkter.map(p => [p.yrke, p.bas, p.nKv, p.nMa, r1(p.kvot), r1(p.gransLag), r1(p.gransHog), p.utanfor ? 'Utanför gränserna' : 'Inom gränserna'])]]);
    const arKv = r => typeof r.kon === 'string' && r.kon.includes('kvinna'), arMa = r => r.kon === 'man' || r.kon === 'män';
    const alder = _konAlderGapRader(d.filter(arKv), d.filter(arMa), k);
    if (alder.visade.length) ut.push(['Löneskillnad per ålder', [
        ['Löneskillnad per åldersgrupp (Ålder & karriär)'],
        ...(alder.dolda.length ? [[`Visas inte, ett kön har färre än ${k} ${personOrd(k)}: ${alder.dolda.join(', ')}.`]] : []), [],
        ['Åldersgrupp', 'Antal kvinnor', 'Antal män', 'Median kvinnor (kr)', 'Median män (kr)', 'Kvinnors median i % av mäns', 'Konfidensintervall 95 %, nedre', 'Konfidensintervall 95 %, övre'],
        ...alder.visade.map(a => [a.namn, a.nKv, a.nMa, Math.round(a.medKv), Math.round(a.medMa), r1(a.gap), a.ci ? r1(a.ci.lo) : '', a.ci ? r1(a.ci.hi) : ''])]]);
    // Lönepolitik: bara när ett ställningstagande är inläst och matchar underlaget (75-lonepolitik.js).
    const lp = typeof _lpExcelBlad === 'function' ? _lpExcelBlad() : null;
    if (lp) ut.push(['Lönepolitik', lp]);
    const referenser = _rrExcelBlad();
    if (referenser) ut.push(['Referenser', referenser]);
    return ut;
}

/** Metodraden för bladet Lönepolitik, när det finns i arbetsboken. */
function _excelLonepolitikMetod(blad) {
    if (!blad.some(b => b[0] === 'Lönepolitik')) return [];
    return [['Bladet Lönepolitik', `Läget i referensens lönespann (0 % = P10, 100 % = P90) per yrkesgrupp, per kön och BAS-intervall samt fördelningen i spannets tredjedelar per kön och efterlevnaden per BAS-intervall — samma mått och samma regler för minsta gruppstorlek som avsnittet Mot ställningstagandet i fliken Löneläget: yrkesgrupper under ${kTroskel()} ${personOrd(kTroskel())} utan lönemått, könsuppdelade mått bara där varje kön har minst ${kTroskel()} ${personOrd(kTroskel())}.`]];
}

// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function exportAllToExcel(...a) { return medExportLage(() => _exportAllToExcelExport.apply(null, /** @type {any} */ (a))); }
function _exportAllToExcelExport() {
    if (!state.data.length) { alert('Läs in lönefilen först.'); return; }
    if (typeof XLSX === 'undefined') { alert('Exporten kunde inte starta: en del av verktyget saknas i filen. Ladda om sidan; hjälper det inte, hämta verktyget på nytt.'); return; }
    const wb = _excelAlltBok();
    XLSX.writeFile(wb, `lonekartlaggning_komplett_${new Date().toISOString().slice(0,10)}.xlsx`);
    _showExportSensitivityToast();
}

/** Bygger arbetsboken för "Excel (alla flikar)". */
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function _excelAlltBok(...a) { return medExportLage(() => __excelAlltBokExport.apply(null, /** @type {any} */ (a))); }
function __excelAlltBokExport() {

    // Self-healing: säkerställ att flik-tabellerna är renderade innan de läses.
    // Täcker både den deferrade inläsningen (skevhet/kon körs strax efter load)
    // och flikar som aldrig besökts (EU-matrisen renderades annars först vid
    // flikbesök → arket föll tyst bort ur exporten).
    const ensure = (sel, fn) => { if (!document.querySelector(sel)) { try { fn(); } catch (_e) { /* tolerant */ } } };
    ensure('#rapport-table tbody tr', generateRapport);
    ensure('#skevhet-table tbody tr', generateSkevhet);
    ensure('#matrix-table tbody tr', generateEUDirectiveMatrix);
    if (state.policy.length || state.statistik.length) ensure('#prio-table tbody tr', renderPrioritering);
    if (state.statistik.length) ensure('#benchmark-table tbody tr', generateBenchmark);

    const wb = XLSX.utils.book_new();
    const tableToSheet = (id, fallback) => {
        const sheet = tableToCleanSheet(id);
        if (sheet) return sheet;
        return fallback ? XLSX.utils.aoa_to_sheet(fallback) : null;
    };

    // Bladet Löneöversikt
    const rapportSheet = tableToSheet('rapport-table');
    if (rapportSheet) XLSX.utils.book_append_sheet(wb, rapportSheet, 'Löneöversikt');

    // Bladet Per BAS: tabellerna i den form en skriven lönekartläggning brukar ha (samma underlag som Word-utkastets
    // avsnitt Lönestruktur per BAS-intervall; tröskeln tillämpas i src/lib/perbas.js).
    const perBasRader = _excelPerBasRader();
    if (perBasRader) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(perBasRader), 'Per BAS');
    // Bladet Egna tabeller (ADR-52): recepten ur Utforska, räknade med tröskeln.
    const egnaRader = _excelEgnaRader();
    if (egnaRader) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(egnaRader), 'Egna tabeller');

    // Sheet: EU-Lönekartläggning
    const matrixSheet = tableToSheet('matrix-table');
    // Reservationen om lönebegreppet (beslut 7a) under tabellen: rubrikraden och kolumnerna står kvar där de stod.
    if (matrixSheet) XLSX.utils.sheet_add_aoa(matrixSheet, [[], [EU_LONEBEGREPP_RESERVATION]], { origin: -1 });
    if (matrixSheet) XLSX.utils.book_append_sheet(wb, matrixSheet, 'EU-lönekartläggning');

    // Sheet: Prioritering
    const prioSheet = tableToSheet('prio-table');
    if (prioSheet) XLSX.utils.book_append_sheet(wb, prioSheet, 'Prioritering');

    // Sheet: Lönegap & Könsfördelning
    const paygapSheet = tableToSheet('paygap-table');
    if (paygapSheet) XLSX.utils.book_append_sheet(wb, paygapSheet, 'Löneskillnad');
    const skevhetSheet = tableToSheet('skevhet-table');
    if (skevhetSheet) XLSX.utils.book_append_sheet(wb, skevhetSheet, 'Könsskevhet');
    const diagramBlad = _excelDiagramBlad();
    for (const [namn, rader] of diagramBlad) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rader), namn);
    // Tabellerna per AID-kod och BAS-intervall (45-aid-bas-tabeller.js): fyra blad, kalkylbladen färdiga med talformat.
    for (const [namn, ws] of _aidbasExcelBlad()) XLSX.utils.book_append_sheet(wb, ws, namn);

    // Sheet: Sektorer (AID-huvudområden, ADR-33) — samma k-regler som vyn.
    ensure('#sektor-table tbody tr', () => renderSektorer(getData()));
    const sektorSheet = tableToSheet('sektor-table');
    if (sektorSheet) XLSX.utils.book_append_sheet(wb, sektorSheet, 'Sektorer');

    // Sheet: Benchmark mot jämförelsestatistiken
    // Bara med inläst jämförelsestatistik: samma villkor som förhandsbeskedet (excelAlltBlad), oberoende av vilka flikar som visats.
    const bmSheet = state.statistik.length ? tableToSheet('benchmark-table') : null;
    if (bmSheet) {
        // Tabellen följer flikens filter; säg det i bladet (ADR-35).
        if (jamforelseUrvalText()) XLSX.utils.sheet_add_aoa(bmSheet, [[], [jamforelseUrvalText()]], { origin: -1 });
        XLSX.utils.book_append_sheet(wb, bmSheet, 'Jämförelsestatistik');
    }

    // Bladet Sakliga skäl: handlingsplanens skäl per grupp och per kategori (bara när någon rad har skäl).
    const skalRader = _excelSkalRader();
    if (skalRader) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(skalRader), 'Sakliga skäl');

    // Sheet: Underlagets kvalitet (ADR-19)
    const uk = bedomningUnderlag();
    if (uk) {
        const ukRows = [
            ['Underlagets kvalitet', UK_ETIKETT[uk.status]],
            [],
            ['Kriterium', 'Status', 'Värde', 'Förklaring']
        ];
        uk.kriterier.forEach(c => ukRows.push([c.namn, UK_ETIKETT[c.status], (typeof c.varde === 'number') ? Math.round(c.varde * 10) / 10 : (c.varde ?? ''), c.text]));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ukRows), 'Underlagets kvalitet');
    }

    // Sheet: Metodik & urval (audit)
    const metRows = [
        ['Metodik & urval — kvalitetssäkring'],
        ['Genererad', new Date().toLocaleString('sv-SE')],
        []
    ];
    auditPoster().forEach(([id, a]) => {
        metRows.push([a.title || id]);
        metRows.push(['Total i datafilen', a.totalRaw]);
        [...(a.parseExcl||[]), ...(a.analysisExclusions||[])].forEach(([r,c]) => {
            metRows.push(['− ' + _htmlTillText(r), c]);
        });
        const used = a.usedInAnalysis !== undefined ? a.usedInAnalysis : a.afterFilter;
        metRows.push(['= Använda i analysen', used]);
        metRows.push([]);
        if (a.formler && a.formler.length) {
            metRows.push(['Formler & definitioner']);
            a.formler.forEach(([n, dsc]) => metRows.push(['  ' + n, _htmlTillText(dsc)]));
            metRows.push([]);
        }
        if (a.notes && a.notes.length) {
            metRows.push(['Speciella regler']);
            a.notes.forEach(n => metRows.push(['  ' + _htmlTillText(n)]));
            metRows.push([]);
        }
    });
    // Tabellerna per AID-kod och BAS-intervall: grupperingen, små grupper, gränserna för slumpen och definitionen.
    metRows.push(['Tabellerna per AID-kod och BAS-intervall']);
    for (const [rubrik, text] of _aidbasMetodRader()) metRows.push(['  ' + rubrik, text]);
    metRows.push([]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metRows), 'Metodik');

    // Två blad som liknar varandra: Per BAS är lönestrukturen som i en skriven lönekartläggning, Lonegap är Lika arbetes
    // kvot per intervall. Båda behålls; raden säger vad som skiljer dem.
    _appendMethodSheet(wb, { extra: [
        ['Bladen Per BAS och Löneskillnad', 'Per BAS är lönestrukturen per BAS-intervall som i en skriven lönekartläggning: referensen, organisationen och varje yrkesgrupp med P10, median, P90 och antal, per kön. Löneskillnad är tabellen ur Lönestruktur: kvinnors medianlön i procent av mäns per BAS-intervall, med antal och medianer. Samma underlag, två frågor.'],
        ..._excelLonepolitikMetod(diagramBlad), ..._aidbasMetodRader()] });
    return wb;
}

// ---- Joint Pay Assessment-protokoll (EU 2023/970 Art. 10) ----
/**
 * Etiketterna för de två "exkluderade p.g.a. k-anonymitet"-raderna. Yrkesgrupperna
 * prövas mot redovisningströskeln (kTroskel()); BAS-regressionen avgörs av
 * statGolv() (se _computePerBasGap), så dess rad nämner golvet.
 */
function _jpaExkluderadeTexter() {
    return {
        yrken: `  Utelämnade: färre än ${kTroskel()} av ett kön (k-anonymitet)`,
        bas: `  Utelämnade: färre än ${statGolv()} av ett kön (k-anonymitet)`
    };
}
/**
 * Genererar en samrådsprotokoll-Excel speciellt utformad för facklig samverkan.
 *
 * Strikt EU 2023/970 Art. 10-process:
 *   - Listar yrkesgrupper med statusen Värt att granska (säkerställd skillnad på minst 3 %, ADR-59) med kolumnen
 *     Ojusterad löneskillnad ≥ 5 % (direktivmarkeringen), och BAS-intervall där regressionens skillnad är
 *     säkerställd också efter korrigering för många tester (Benjamini–Hochberg, q < 0,05) och minst 3 %, som
 *     regressionskortet och Att göra (ADR-71)
 *   - K-anonymitet appliceras: grupper med färre än kTroskel() personer av något kön exkluderas helt
 *   - Tomma protokoll-fält för sakliga skäl, fackliga kommentar, åtgärder
 *   - Signaturblad för arbetsgivare + fackliga representanter
 *   - Transparens om vad som EXKLUDERATS p.g.a. k-anonymitet (antal, ingen PII)
 *
 * Output: lonekartlaggning_JPA_protokoll_YYYY-MM-DD.xlsx
 */
// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function exportJPAProtocol(...a) { return medExportLage(() => _exportJPAProtocolExport.apply(null, /** @type {any} */ (a))); }
function _exportJPAProtocolExport() {
    if (!state.data.length) { alert('Läs in lönefilen först.'); return; }
    if (typeof XLSX === 'undefined') { alert('Exporten kunde inte starta: en del av verktyget saknas i filen. Ladda om sidan; hjälper det inte, hämta verktyget på nytt.'); return; }

    const d = getData();
    const now = new Date();
    const isoDate = now.toISOString().slice(0, 10);
    const localDate = now.toLocaleDateString('sv-SE');
    const profileLabel = state.profile.benchmarkLabel;

    // § 3:10-paren beräknas EN GÅNG här, så att försättssidan och flik 3b
    // alltid är konsistenta.
    const lvResult = typeof computeLikvardighetPairs === 'function'
        ? computeLikvardighetPairs()
        : null;
    // Synka cachen så ev. efterföljande tabb-render visar samma siffror.
    if (state.likvardighet) state.likvardighet.result = lvResult;
    // k-anonymitet: protokollet redovisar bara par där båda grupperna når tröskeln (undantaget gäller
    // bara fliken Likvärdigt arbete); antalet som utelämnats anges i stället.
    const lvRedovisning = _parForRedovisning(lvResult?.pairs);
    const lvPairsCount = lvRedovisning.par.length;

    // ---- A) Identifiera JPA-grupper (lika arbete = yrkesgrupp) ----
    // Samma grupper och samma status som Lika arbete (laLikaGrupper, ADR-59): Värt att granska = skillnaden mellan
    // medianerna är säkerställd mot slumpens gränser för gruppen och minst 3 %. k-anonymitet som i tabellen.
    const lika = laLikaGrupper(d);
    const jamforda = lika.grupper.filter(g => !g.samladMedian);
    const jpaYrken = jamforda.filter(g => g.niva === 'granska').map(g => ({
        yrke: g.yrke, nKv: g.nKv, nMa: g.nMa, tot: g.tot,
        medKv: Math.round(g.medKv), medMa: Math.round(g.medMa),
        gapPct: +((g.kvot - 1) * 100).toFixed(2),   // negativ = kvinnor lägre
        diffKr: Math.round(g.medKv - g.medMa), direktiv: g.direktiv
    }));
    const yrkenExkluderadeMaskerade = lika.grupper.filter(g => g.samladMedian).length + lika.utelamnade.length + lika.ejJamforbara.length;
    const yrkenEjBedomda = jamforda.filter(g => g.niva === 'ejbedomd').length;
    const yrkenExkluderadeOjamn = jamforda.filter(g => g.niva === 'folj' || g.niva === 'balanserat').length;
    jpaYrken.sort((a, b) => a.gapPct - b.gapPct);  // mest negativa (mest kritiska) först

    // ---- B) Identifiera JPA-grupper (likvärdigt arbete = BAS-intervall) ----
    // OLS-regression per BAS, kräver minst statGolv() av varje kön
    const basList = [...new Set(d.map(r => r.bas))].sort();
    const perBas = _computePerBasGap(d, basList);
    // Korrigering för många samtidiga tester (Benjamini–Hochberg) över samma tester som regressionskortet och Att
    // göra: intervallen med status ok och ändligt p-värde. Ett enda test ger q = p.
    const okTests = perBas.filter(b => b.status === 'ok' && isFinite(b.pValue));
    const qVarden = _bhJustera(okTests.map(b => b.pValue));
    const bhQ = new Map(okTests.map((b, i) => [b, qVarden[i]]));
    let basExkluderadeMaskerade = 0;
    let basExkluderadeSingular = 0;
    let basExkluderadeUnderTröskel = 0;
    const jpaBas = [];
    perBas.forEach(b => {
        if (b.status === 'too_few')    { basExkluderadeMaskerade++; return; }
        if (b.status === 'singular')   { basExkluderadeSingular++; return; }
        // Regressionens tal är justerat: samma regel som statusen (säkerställd efter korrigering och minst 3 %), ingen
        // direktivmarkering. Ett intervall utan ändligt p-värde har inget q och räknas som inte säkerställt.
        const q = bhQ.get(b);
        if (q == null || _stsPerBasSignal(b.gapPct, q < 0.05, b.pValue < 0.05).niva !== 'titta') { basExkluderadeUnderTröskel++; return; }
        jpaBas.push({ ...b, q });
    });
    jpaBas.sort((a, b) => a.gapPct - b.gapPct);

    // ---- C) Bygg arbetsbok ----
    const wb = XLSX.utils.book_new();

    // === Sheet 1: Försättssida + samrådsinformation ===
    const coverRows = [
        ['GEMENSAM LÖNEBEDÖMNING — SAMVERKANSPROTOKOLL', ''],
        ['Direktiv (EU) 2023/970 om lönetransparens, gemensam lönebedömning', ''],
        ['Diskrimineringslagen 3 kap. (lönekartläggning)', ''],
        ['', ''],
        ['Genererad', localDate + ' ' + now.toLocaleTimeString('sv-SE')],
        ['Verktyg', `Öppen lönekartläggning (v${APP_VERSION})`],
        ['Aktiv profil', state.profile.name],
        ['Jämförelseinstitution', profileLabel],
        ['', ''],
        ['— OMFATTNING —', ''],
        ['Totalt antal personer i underlaget', d.length],
        ['Antal yrkesgrupper med statusen Värt att granska: säkerställd skillnad på minst 3 % (lika arbete)', jpaYrken.length],
        ['  varav ojusterad löneskillnad ≥ 5 % (direktivmarkeringen)', jpaYrken.filter(j => j.direktiv).length],
        ['Antal BAS-intervall med en säkerställd oförklarad skillnad på minst 3 %', jpaBas.length],
        [`Antal ${lvRedovisning.not ? 'redovisade ' : ''}kandidatpar i likvärdigt arbete (kvinnodominerat yrke mot ett yrke som inte är kvinnodominerat, med lika eller lägre krav)`, lvPairsCount],
        ...(lvRedovisning.not ? [['  Utelämnade kandidatpar', lvRedovisning.not]] : []),
        ['', ''],
        ['— DELTAGARE I SAMRÅDET —', '(fylls i av parterna)'],
        ['Datum för samråd', ''],
        ['Plats / form', ''],
        ['Arbetsgivarens representant 1 (namn)', ''],
        ['Arbetsgivarens representant 1 (befattning)', ''],
        ['Arbetsgivarens representant 2 (namn)', ''],
        ['Arbetsgivarens representant 2 (befattning)', ''],
        ['Facklig representant 1 (namn)', ''],
        ['Facklig representant 1 (organisation)', ''],
        ['Facklig representant 2 (namn)', ''],
        ['Facklig representant 2 (organisation)', ''],
        ['Facklig representant 3 (namn)', ''],
        ['Facklig representant 3 (organisation)', ''],
        ['Övriga närvarande', ''],
        ['', ''],
        ['— GEMENSAM SAMMANFATTNING —', '(fylls i efter samrådet)'],
        ['Huvudsakliga slutsatser', ''],
        ['Övergripande åtgärdsplan', ''],
        ['Tidplan för åtgärder', ''],
        ['Nästa uppföljning (datum)', ''],
        ['', ''],
        ['Bifoga protokollet till årets dokumentation av lönekartläggningen.', ''],
        ['Originalexemplar förvaras i låst arkiv enligt arbetsgivarens dokumenthanteringsplan.', '']
    ];
    const coverSheet = XLSX.utils.aoa_to_sheet(coverRows);
    coverSheet['!cols'] = [{ wch: 50 }, { wch: 60 }];
    coverSheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } }
    ];
    XLSX.utils.book_append_sheet(wb, coverSheet, '1. Försättssida');

    // === Sheet 2: Yrkesgrupper med statusen Värt att granska (lika arbete) ===
    const yrkenHeaderRow = [
        'Nr', 'AID / Yrkesgrupp', 'N totalt', 'N kvinnor', 'N män',
        'Median kvinnor (kr)', 'Median män (kr)', 'Differens (kr)', 'Kvinnors median i % av mäns', _STS_DIR_KOLUMN,
        // Tomma protokollfält
        'Sakliga skäl — arbetsgivarens analys',
        'Fackliga partens kommentar / motargument',
        'Status efter samråd (motiverat / behöver åtgärd / oklart)',
        'Överenskommen åtgärd',
        'Tidplan',
        'Ansvarig'
    ];
    const yrkenRows = [yrkenHeaderRow];
    if (jpaYrken.length === 0) {
        yrkenRows.push(['—', 'Inga yrkesgrupper med statusen Värt att granska, bland grupperna som når minsta gruppstorlek', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    } else {
        jpaYrken.forEach((j, idx) => {
            yrkenRows.push([
                idx + 1, j.yrke, j.tot, j.nKv, j.nMa,
                j.medKv, j.medMa, j.diffKr, typeof j.gapPct === 'number' ? +(100 + j.gapPct).toFixed(1) : j.gapPct, j.direktiv ? _STS_DIR_ETIKETT : '',
                '', '', '', '', '', ''  // protokoll-celler tomma
            ]);
        });
    }
    if (jpaYrken.length) yrkenRows.push([], ['', `${_STS_DIR_KOLUMN}: ${_STS_DIR_TIPS}`]);
    const yrkenSheet = XLSX.utils.aoa_to_sheet(yrkenRows);
    yrkenSheet['!cols'] = [
        { wch: 4 }, { wch: 42 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
        { wch: 50 }, { wch: 50 }, { wch: 32 }, { wch: 40 }, { wch: 18 }, { wch: 22 }
    ];
    yrkenSheet['!freeze'] = { xSplit: 2, ySplit: 1 };
    _applyColumnNumFormats(yrkenSheet, SV_NUM_FORMATS);
    XLSX.utils.book_append_sheet(wb, yrkenSheet, '2. Lika arbete (yrken)');

    // === Sheet 3: BAS-intervall med säkerställd oförklarad skillnad på minst 3 % (likvärdigt arbete) ===
    const basHeaderRow = [
        'Nr', 'BAS-intervall', 'N totalt', 'N kvinnor', 'N män',
        'Oförklarad skillnad (%)', '95 % KI lägre', '95 % KI övre',
        'p-värde', 'q-värde (BH-justerat)', 'R² för modellen', 'Säkerställd efter korrigering (q < 0,05)',
        // Protokoll-fält
        'Sakliga skäl — arbetsgivarens analys',
        'Fackliga partens kommentar',
        'Status efter samråd',
        'Överenskommen åtgärd',
        'Tidplan',
        'Ansvarig'
    ];
    const basRows = [basHeaderRow];
    if (jpaBas.length === 0) {
        basRows.push(['—', 'Inga BAS-intervall med en säkerställd oförklarad skillnad på minst 3 %, bland intervallen som når minsta gruppstorlek', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    } else {
        jpaBas.forEach((b, idx) => {
            basRows.push([
                idx + 1, b.bas, b.n, b.kvN, b.maN,
                +b.gapPct.toFixed(2), +b.ciLow.toFixed(2), +b.ciHigh.toFixed(2),
                b.pValue < 0.001 ? '< 0.001' : +b.pValue.toFixed(4),
                b.q < 0.001 ? '< 0.001' : +b.q.toFixed(4),
                +(b.R2 * 100).toFixed(1) + '%',
                b.q < 0.05 ? 'Ja' : 'Nej',
                '', '', '', '', '', ''
            ]);
        });
    }
    const basSheet = XLSX.utils.aoa_to_sheet(basRows);
    basSheet['!cols'] = [
        { wch: 4 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 18 },
        { wch: 50 }, { wch: 50 }, { wch: 32 }, { wch: 40 }, { wch: 18 }, { wch: 22 }
    ];
    basSheet['!freeze'] = { xSplit: 2, ySplit: 1 };
    _applyColumnNumFormats(basSheet, SV_NUM_FORMATS);
    XLSX.utils.book_append_sheet(wb, basSheet, '3. Likvärdigt arbete (BAS)');

    // === Sheet 3b: § 3:10 Likvärdighet (kv-dom yrken vs yrken som inte är kv-dom, ADR-60) ===
    // Använder lvResult som beräknats högst upp i
    // funktionen — så försättssidans räknare och tabellen i flik 3b alltid
    // är från samma compute.
    if (lvResult && lvResult.pairs.length && !lvRedovisning.par.length) {
        // Alla par har en grupp under tröskeln: arket anger det i stället för att tiga eller påstå att par saknas.
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[lvRedovisning.not]]), '3b. Likvärdigt arbete (krav)');
    }
    if (lvRedovisning.par.length) {
        // Inom-organisationen-jämförelse primär, jämförelsestatistiken
        // som extern fallback per BAS. Bootstrap-CI på varje par.
        const lvSig = ci => !ci ? 'CI ej beräknad' : (ci.lo > 0 ? 'Säker (CI > 0)' : 'Slump? (CI överlappar 0)');
        const lvKälla = p => p.jamforKalla === 'intern' ? 'Intern (organisation)'
            : (p.maKlassKort === 'lokal' ? 'jämförelsestatistiken' : 'SKR:s personalstatistik');
        const lvHeader = [
            'Nr',
            'Org. AID', 'Org. Yrke', 'BAS', 'Org. n', 'Org. % kvinnor', 'Median Org. (kr)',
            'Jämf. AID', 'Jämf. Yrke', 'Jämf. % kvinnor', 'Jämf. klass', 'Jämf. n', 'Jämförelsekälla', 'Median Jämf. (kr)',
            'Skillnad (kr)', 'Skillnad (%)', '95 % KI lägre (kr)', '95 % KI övre (kr)', 'Säkerhet', 'Summa för gruppen (kr/mån)',
            'Sakliga skäl — arbetsgivarens analys',
            'Fackliga partens kommentar',
            'Status efter samråd',
            'Överenskommen åtgärd',
            'Tidplan',
            'Ansvarig'
        ];
        const lvRows = [lvHeader];
        lvRedovisning.par.forEach((p, i) => lvRows.push([
            i + 1,
            p.kvAid, p.kvLabel, p.kvBas, p.kvN, +p.kvKvinnoPct.toFixed(1), Math.round(p.kvMedian),
            p.maAid, p.maLabel, +p.maKvAndel.toFixed(1), konsklassOrd(p.maKlass), p.maN != null ? p.maN : '—', lvKälla(p), Math.round(p.maMedian),
            Math.round(p.gapKr), +p.gapPct.toFixed(2),
            p.gapCI ? Math.round(p.gapCI.lo) : '—',
            p.gapCI ? Math.round(p.gapCI.hi) : '—',
            lvSig(p.gapCI),
            Math.round(p.allvarsindex),
            '', '', '', '', '', ''
        ]));
        if (lvRedovisning.not) lvRows.push([], [lvRedovisning.not]);
        const lvSheet = XLSX.utils.aoa_to_sheet(lvRows);
        lvSheet['!cols'] = [
            { wch: 4 }, { wch: 8 }, { wch: 28 }, { wch: 6 }, { wch: 7 }, { wch: 12 }, { wch: 14 },
            { wch: 8 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 7 }, { wch: 20 }, { wch: 14 },
            { wch: 11 }, { wch: 8 }, { wch: 13 }, { wch: 13 }, { wch: 24 }, { wch: 14 },
            { wch: 50 }, { wch: 50 }, { wch: 28 }, { wch: 40 }, { wch: 18 }, { wch: 22 }
        ];
        lvSheet['!freeze'] = { xSplit: 3, ySplit: 1 };
        _applyColumnNumFormats(lvSheet, SV_NUM_FORMATS);
        // OBS: kolon är förbjudet i Excel-arknamn (SheetJS kastar) — därav "3-10".
        // Demodata saknar § 3:10-par, så arket prövas bara med riktiga par.
        XLSX.utils.book_append_sheet(wb, lvSheet, '3b. Likvärdigt arbete (krav)');
    }

    // === Sheet 4: Exkluderade grupper (transparens om k-anonymitet) ===
    const excludedRows = [
        ['EXKLUDERADE GRUPPER — transparens för fackliga parter', ''],
        ['', ''],
        ['Inga personidentifierande uppgifter visas. Endast antal exkluderade grupper.', ''],
        ['', ''],
        ['Lika arbete (yrkesgrupper):', ''],
        [_jpaExkluderadeTexter().yrken, yrkenExkluderadeMaskerade],
        ['  Går ej att bedöma (ett kön under ' + statGolv() + ' ' + personOrd(statGolv()) + ')', yrkenEjBedomda],
        ['  Inte Värt att granska (Följ upp eller Balanserat)', yrkenExkluderadeOjamn],
        ['', ''],
        ['Likvärdigt arbete (BAS-intervall):', ''],
        [_jpaExkluderadeTexter().bas, basExkluderadeMaskerade],
        ['  Utelämnade: regressionen gick inte att skatta (multikollinearitet)', basExkluderadeSingular],
        ['  Inte säkerställd efter korrigering för många tester, eller under 3 % (oförklarad skillnad)', basExkluderadeUnderTröskel],
        ['', ''],
        ['Statusen bygger på statistisk signal: säkerställd skillnad och minst 3 % (verktygets storleksgräns). Lagen kräver ändå att varje skillnad analyseras.', ''],
        [`${_STS_DIR_KOLUMN}: ${_STS_DIR_TIPS}`, ''],
        [`k-anonymitet (n<${kTroskel()}) skyddar enskilda anställdas integritet (uppgiftsminimering och inbyggt dataskydd enligt dataskyddsförordningen).`, ''],
        ['Grupper under k-tröskeln kan inte analyseras säkert utan risk för återidentifiering.', ''],
        ['Om dessa grupper behöver granskas separat bör det ske utan numeriska bilagor.', '']
    ];
    const excludedSheet = XLSX.utils.aoa_to_sheet(excludedRows);
    excludedSheet['!cols'] = [{ wch: 60 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, excludedSheet, '4. Exkluderat (k-anon)');

    // === Sheet 5: Metodik & rättslig grund ===
    const metodikRows = [
        ['METODIK & RÄTTSLIG GRUND', ''],
        ['', ''],
        ['— Rättslig grund —', ''],
        ['Lönetransparensdirektivet, gemensam lönebedömning', 'Gemensam lönebedömning krävs hos arbetsgivare som lönerapporterar när skillnaden i någon kategori arbetstagare är 5 % eller mer, inte motiveras av objektiva könsneutrala kriterier och inte åtgärdats inom sex månader.'],
        ['Lönetransparensdirektivet, gemensam lönebedömning', 'Bedömningen görs tillsammans med arbetstagarnas företrädare; åtgärder inom rimlig tid.'],
        ['Diskrimineringslagen, lönekartläggning', 'Lagen kräver att du prövar om en skillnad har samband med kön. En skillnad som har sakliga skäl, till exempel ansvar eller erfarenhet, är inte osaklig.'],
        ['Diskrimineringslagen, likvärdigt arbete', 'Likvärdigt arbete bedöms utifrån de krav arbetet ställer (kunskap och färdigheter, ansvar, ansträngning och arbetsförhållanden).'],
        ['Diskrimineringslagen, kvinnodominerat arbete', 'Arbetsgivaren ska analysera om kvinnodominerade yrken har lägre lön än yrken som inte är kvinnodominerade och har likvärdiga eller lägre krav i arbetet. Verktyget jämför med yrken på samma nivå som inte är kvinnodominerade; könsandelen i jämförelseyrket står i tabellen. BAS-rank används i flik 3b som ordinal proxy för arbetskrav — slutgiltig kravvärdering kräver kvalitativ granskning.'],
        ['Diskrimineringslagen, åtgärder', 'Löneskillnader som saknar sakliga skäl ska rättas så snart som möjligt och senast inom tre år.'],
        ['', ''],
        ['— Statistisk metodik —', ''],
        ['Lika arbete (yrkesgrupp)', 'Direkt median-jämförelse mellan kvinnors och mäns löner inom samma AID-kod. Kvinnors median i procent av mäns = median_kv / median_mä × 100; under 100 betyder att kvinnor ligger lägre.'],
        ['Likvärdigt arbete (BAS-intervall)', `OLS-regression: log(lön) ~ kön${harAlder() ? ' + ålder (centrerad)' : ''} inom varje BAS. Oförklarad skillnad = könskoefficienten omräknad till procentskillnad. HC3-robusta standardfel (Long & Ervin 2000).${harAlder() ? '' : ' Lönefilen saknar ålder, så ålder räknas inte bort.'}`],
        ['Konfidensintervall', '95% KI = β ± t(0,975; n−k) × HC3 robust SE, transformerat tillbaka från log-skala; t-kvantilen är 1,96 vid n−k ≥ 100 och större vid färre frihetsgrader.'],
        ['Statistisk signifikans', 'p < 0.05 = ej slumpmässig skillnad. För BAS-intervallen gäller gränsen q-värdet efter korrigering för många tester, inte det råa p-värdet (se Multipel jämförelse).'],
        ['', ''],
        ['— k-anonymitet —', ''],
        ['Tröskel', `n ≥ ${kTroskel()} per kön krävs för att en grupp ska redovisas individuellt.`],
        ['Bakgrund', 'Skydd mot återidentifiering av enskilda anställda via deduktion (kön + ålder + yrke + BAS).'],
        ['Konsekvens', 'Små grupper exkluderas helt från detta protokoll. Antal exkluderade redovisas i flik 4.'],
        ['', ''],
        ['— Begränsningar att vara medvetna om —', ''],
        ['Sakliga skäl', 'Verktyget identifierar löneskillnader men avgör inte vad som är saklig grund. Den bedömningen är gemensamma parters ansvar.'],
        ...(harAlder() ? [['Modellantaganden', 'OLS antar linjär samband mellan ålder och log(lön). Lifecycle-analysen (i verktygets EU-flik) testar detta antagande med kvadratisk åldersterm.']] : []),
        ['Multipel jämförelse', 'Ett test per BAS-intervall körs samtidigt, och av ren slump förväntas ungefär 1 falskt positivt resultat per 20 tester. Därför korrigeras p-värdena med Benjamini–Hochbergs metod (andelen falska upptäckter). Flik 3 tar med ett BAS-intervall bara när q-värdet efter korrigeringen är under 0,05 och skillnaden är minst 3 %, samma regel som i verktyget. Det råa p-värdet står bredvid för jämförelse.']
    ];
    const metodikSheet = XLSX.utils.aoa_to_sheet(metodikRows);
    metodikSheet['!cols'] = [{ wch: 32 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(wb, metodikSheet, '5. Metodik & rättslig grund');

    // === Sheet 6: Signaturblad ===
    const signRows = [
        ['SIGNATURER — GEMENSAM LÖNEBEDÖMNING', ''],
        ['', ''],
        ['Parterna intygar att de tagit del av detta protokoll och dess slutsatser.', ''],
        ['', ''],
        ['— Arbetsgivarrepresentant 1 —', ''],
        ['Namn', ''],
        ['Befattning', ''],
        ['Signatur', ''],
        ['Datum', ''],
        ['', ''],
        ['— Arbetsgivarrepresentant 2 —', ''],
        ['Namn', ''],
        ['Befattning', ''],
        ['Signatur', ''],
        ['Datum', ''],
        ['', ''],
        ['— Facklig representant 1 —', ''],
        ['Namn', ''],
        ['Organisation', ''],
        ['Signatur', ''],
        ['Datum', ''],
        ['', ''],
        ['— Facklig representant 2 —', ''],
        ['Namn', ''],
        ['Organisation', ''],
        ['Signatur', ''],
        ['Datum', ''],
        ['', ''],
        ['— Facklig representant 3 —', ''],
        ['Namn', ''],
        ['Organisation', ''],
        ['Signatur', ''],
        ['Datum', ''],
        ['', ''],
        ['Originalet förvaras hos arbetsgivaren. Kopior till samtliga underskrivande parter.', '']
    ];
    const signSheet = XLSX.utils.aoa_to_sheet(signRows);
    signSheet['!cols'] = [{ wch: 32 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, signSheet, '6. Signaturer');

    // === Spara filen ===
    const filename = `lonekartlaggning_protokoll_gemensam_lonebedomning_${isoDate}.xlsx`;
    _appendMethodSheet(wb);
    XLSX.writeFile(wb, filename);
    _showExportSensitivityToast();
    announceToScreenReader(`Protokoll för gemensam lönebedömning exporterat: ${jpaYrken.length} yrkesgrupp${jpaYrken.length === 1 ? '' : 'er'} och ${jpaBas.length} BAS-intervall med en säkerställd skillnad på minst 3 %.`);
}

// Multi-flik Excel-export
document.getElementById("btn-export-all-excel")?.addEventListener("click", exportAllToExcel);

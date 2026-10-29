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
    if (!state.data.length) return [];
    const harRef = state.policy.length > 0 || state.statistik.length > 0;
    return ['Löneöversikt', 'Per BAS', 'EU-Lonekartlaggning', ...(harRef ? ['Prioritering'] : []), 'Lonegap', 'Konsskevhet', ..._excelDiagramBlad().map(b => b[0]), 'Sektorer',
        ...(state.statistik.length ? ['Jamforelsestatistik'] : []), ...(bedomningUnderlag() ? ['Underlagets kvalitet'] : []), 'Metodik', 'Metod & parametrar'];
}

/** Raderna i bladet Per BAS, eller null utan underlag. */
function _excelPerBasRader() {
    const pb = typeof rmPerBasUnderlag === 'function' ? rmPerBasUnderlag(getData(), kTroskel()) : null;
    if (!pb || !pb.intervall.length) return null;
    const tal = v => (v == null || !isFinite(v) ? '' : Math.round(v));
    const pct = v => (v == null || !isFinite(v) ? '' : Math.round(v * 10) / 10);
    const rows = [['Lönestruktur per BAS-intervall', `minsta gruppstorlek ${pb.k}: grupper med färre personer redovisas inte`], []];
    for (const i of pb.intervall) {
        rows.push([`BAS ${i.bas}`, `${i.n} anställda, ${i.nKv} kvinnor och ${i.nMa} män, ${i.antalYrken} yrkesgrupper`]);
        rows.push(['Grupp', 'Antal', 'P10', 'Median', 'P90']);
        i.rader.forEach(r => rows.push([r.namn, r.n == null ? '' : r.n, tal(r.p10), tal(r.med), tal(r.p90)]));
        if (i.utelamnade.length) rows.push([`Redovisas inte (färre än ${pb.k} personer): ${i.utelamnade.join(', ')}`]);
        if (!i.konVisas) rows.push([`Kvinnor och män redovisas inte var för sig: ett kön har färre än ${pb.k} personer`]);
        rows.push([]);
    }
    if (pb.basUtelamnade.length) rows.push([`BAS-intervall som inte redovisas (färre än ${pb.k} personer): ${pb.basUtelamnade.join(', ')}`], []);
    rows.push(['Löneskillnader inom likvärdigt arbete, per BAS-intervall']);
    rows.push(['BAS', 'Antal', 'Medellön alla', 'Medellön män', 'Medellön kvinnor', 'Kvinnors medellön i % av mäns', 'Andel kvinnor (%)', 'Medelålder alla', 'Medelålder män', 'Medelålder kvinnor']);
    pb.konsgap.rader.forEach(r => rows.push([r.bas, r.n, tal(r.medel), tal(r.medelMa), tal(r.medelKv), pct(r.kvot), pct(r.andelKv), tal(r.alder), tal(r.alderMa), tal(r.alderKv)]));
    rows.push([], ['Löneskillnader i åldersgrupper, per BAS-intervall']);
    rows.push(['BAS', 'Antal', 'Medelålder', 'Medellön alla', ...pb.aldersgrupper.grupper.map(g => `Medellön ${g} år`)]);
    pb.aldersgrupper.rader.forEach(r => rows.push([r.bas, r.n, tal(r.alder), tal(r.medel), ...r.perGrupp.map(tal)]));
    return rows;
}

/**
 * Talen bakom flikarnas diagram och översiktstabell, som egna blad: det som står i bilden ska gå att räkna vidare på.
 * Samma funktioner som ritar vyerna lämnar raderna, så bladen följer vyernas regler för minsta gruppstorlek — en
 * grupp som inte ritas får ingen rad. Bladen gäller hela organisationen, också när en flik är avgränsad.
 * Sist bladet Lönepolitik (läget i lönespannet per yrkesgrupp och per kön), när ett ställningstagande är inläst.
 * @returns {[string, any[][]][]} bladets namn och rader
 */
function _excelDiagramBlad() {
    const d = getData(), k = kTroskel(), ut = [], r1 = v => Math.round(v * 10) / 10;
    const bas = _laOversiktRader(d);
    if (bas.length) ut.push(['Lika arbete per BAS', [
        ['Kvinnors och mäns lön per BAS-intervall (översiktstabellen på Lika arbete)'], [],
        ['BAS-intervall', 'Antal kvinnor', 'Antal män', 'Median kvinnor (kr)', 'Median män (kr)', 'Skillnad (kr)', 'Kvinnors median i % av mäns', 'Konfidensintervall 95 %, nedre', 'Konfidensintervall 95 %, övre', 'Status'],
        ...bas.map(o => [o.bas, o.nKv, o.nMa, Math.round(o.medKv), Math.round(o.medMa), Math.round(o.medKv - o.medMa), r1(o.gap), o.ci ? r1(o.ci.lo) : '', o.ci ? r1(o.ci.hi) : '', _laOversiktStatus(o).serie])]]);
    const tratt = _laTrattUnderlag(d);
    if (tratt) ut.push(['Slumpens granser', [
        ['Yrkesgrupperna mot slumpens gränser (trattdiagrammet på Lika arbete)'],
        [`Yrkesgrupper där både kvinnor och män är minst ${k}. Gränserna är de 95-procentiga för gruppens storlek.`], [],
        ['Yrkesgrupp', 'BAS-intervall', 'Antal kvinnor', 'Antal män', 'Kvinnors median i % av mäns', 'Gräns, nedre', 'Gräns, övre', 'Bedömning'],
        ...tratt.punkter.map(p => [p.yrke, p.bas, p.nKv, p.nMa, r1(p.kvot), r1(p.gransLag), r1(p.gransHog), p.utanfor ? 'Utanför gränserna' : 'Inom gränserna'])]]);
    const arKv = r => typeof r.kon === 'string' && r.kon.includes('kvinna'), arMa = r => r.kon === 'man' || r.kon === 'män';
    const alder = _konAlderGapRader(d.filter(arKv), d.filter(arMa), k);
    if (alder.visade.length) ut.push(['Lonegap per alder', [
        ['Lönegap per åldersgrupp (Ålder & karriär)'],
        ...(alder.dolda.length ? [[`Visas inte, ett kön har färre än ${k} personer: ${alder.dolda.join(', ')}.`]] : []), [],
        ['Åldersgrupp', 'Antal kvinnor', 'Antal män', 'Median kvinnor (kr)', 'Median män (kr)', 'Kvinnors median i % av mäns', 'Konfidensintervall 95 %, nedre', 'Konfidensintervall 95 %, övre'],
        ...alder.visade.map(a => [a.namn, a.nKv, a.nMa, Math.round(a.medKv), Math.round(a.medMa), r1(a.gap), a.ci ? r1(a.ci.lo) : '', a.ci ? r1(a.ci.hi) : ''])]]);
    // Lönepolitik: bara när ett ställningstagande är inläst och matchar underlaget (75-lonepolitik.js).
    const lp = typeof _lpExcelBlad === 'function' ? _lpExcelBlad() : null;
    if (lp) ut.push(['Lönepolitik', lp]);
    return ut;
}

/** Metodraden för bladet Lönepolitik, när det finns i arbetsboken. */
function _excelLonepolitikMetod(blad) {
    if (!blad.some(b => b[0] === 'Lönepolitik')) return [];
    return [['Bladet Lönepolitik', `Läget i referensens lönespann (0 % = P10, 100 % = P90) per yrkesgrupp, per kön och BAS-intervall samt fördelningen i spannets tredjedelar per kön och efterlevnaden per BAS-intervall — samma mått och samma regler för minsta gruppstorlek som fliken Lönepolitik: yrkesgrupper under ${kTroskel()} personer utan lönemått, könsuppdelade mått bara där varje kön har minst ${kTroskel()} personer.`]];
}

// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function exportAllToExcel(...a) { return medExportLage(() => _exportAllToExcelExport.apply(null, /** @type {any} */ (a))); }
function _exportAllToExcelExport() {
    if (!state.data.length) { alert('Ladda upp data först.'); return; }
    if (typeof XLSX === 'undefined') { alert('XLSX-bibliotek saknas.'); return; }
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

    // Sheet: EU-Lönekartläggning
    const matrixSheet = tableToSheet('matrix-table');
    if (matrixSheet) XLSX.utils.book_append_sheet(wb, matrixSheet, 'EU-Lonekartlaggning');

    // Sheet: Prioritering
    const prioSheet = tableToSheet('prio-table');
    if (prioSheet) XLSX.utils.book_append_sheet(wb, prioSheet, 'Prioritering');

    // Sheet: Lönegap & Könsfördelning
    const paygapSheet = tableToSheet('paygap-table');
    if (paygapSheet) XLSX.utils.book_append_sheet(wb, paygapSheet, 'Lonegap');
    const skevhetSheet = tableToSheet('skevhet-table');
    if (skevhetSheet) XLSX.utils.book_append_sheet(wb, skevhetSheet, 'Konsskevhet');
    const diagramBlad = _excelDiagramBlad();
    for (const [namn, rader] of diagramBlad) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rader), namn);

    // Sheet: Sektorer (AID-huvudområden, ADR-33) — samma k-regler som vyn.
    ensure('#sektor-table tbody tr', () => renderSektorer(getData()));
    const sektorSheet = tableToSheet('sektor-table');
    if (sektorSheet) XLSX.utils.book_append_sheet(wb, sektorSheet, 'Sektorer');

    // Sheet: Benchmark mot jämförelsestatistiken
    const bmSheet = tableToSheet('benchmark-table');
    if (bmSheet) {
        // Tabellen följer flikens filter; säg det i bladet (ADR-35).
        if (jamforelseUrvalText()) XLSX.utils.sheet_add_aoa(bmSheet, [[], [jamforelseUrvalText()]], { origin: -1 });
        XLSX.utils.book_append_sheet(wb, bmSheet, 'Jamforelsestatistik');
    }

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
    Object.entries(auditRegistry).forEach(([id, a]) => {
        metRows.push([a.title || id]);
        metRows.push(['Total i datafilen', a.totalRaw]);
        [...(a.parseExcl||[]), ...(a.analysisExclusions||[])].forEach(([r,c]) => {
            metRows.push(['− ' + r.replace(/<[^>]+>/g, ''), c]);
        });
        const used = a.usedInAnalysis !== undefined ? a.usedInAnalysis : a.afterFilter;
        metRows.push(['= Använda i analysen', used]);
        metRows.push([]);
        if (a.formler && a.formler.length) {
            metRows.push(['Formler & definitioner']);
            a.formler.forEach(([n, dsc]) => metRows.push(['  ' + n, dsc.replace(/<[^>]+>/g, '')]));
            metRows.push([]);
        }
        if (a.notes && a.notes.length) {
            metRows.push(['Speciella regler']);
            a.notes.forEach(n => metRows.push(['  ' + n.replace(/<[^>]+>/g, '')]));
            metRows.push([]);
        }
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metRows), 'Metodik');

    _appendMethodSheet(wb, { extra: _excelLonepolitikMetod(diagramBlad) });
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
        yrken: `  Exkluderade p.g.a. k-anonymitet (n<${kTroskel()} per kön)`,
        bas: `  Exkluderade p.g.a. k-anonymitet (n<${statGolv()} per kön)`
    };
}
/**
 * Genererar en samrådsprotokoll-Excel speciellt utformad för facklig samverkan.
 *
 * Strikt EU 2023/970 Art. 10-process:
 *   - Listar enbart grupper med oförklarat gap > 5% (utredningskrav)
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
    if (!state.data.length) { alert('Ladda upp data först.'); return; }
    if (typeof XLSX === 'undefined') { alert('XLSX-bibliotek saknas.'); return; }

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
    // Median-jämförelse + k-anonymitet
    const yrkeGroups = {};
    d.forEach(r => {
        if (!yrkeGroups[r.yrke]) yrkeGroups[r.yrke] = { kv: [], ma: [] };
        if (r.kon.includes('kvinna'))               yrkeGroups[r.yrke].kv.push(r);
        else if (r.kon === 'man' || r.kon === 'män') yrkeGroups[r.yrke].ma.push(r);
    });
    const jpaYrken = [];
    let yrkenExkluderadeMaskerade = 0;
    let yrkenExkluderadeOjamn = 0;
    Object.entries(yrkeGroups).forEach(([yrke, g]) => {
        if (g.kv.length === 0 && g.ma.length === 0) return;  // tom
        if (g.kv.length < kTroskel() || g.ma.length < kTroskel()) {
            yrkenExkluderadeMaskerade++;
            return;
        }
        const medKv = Stat.median(g.kv.map(r => r.lon));
        const medMa = Stat.median(g.ma.map(r => r.lon));
        if (medMa <= 0) return;
        const gapPct = (medKv / medMa - 1) * 100;  // negativ = kvinnor lägre
        if (Math.abs(gapPct) <= 5) { yrkenExkluderadeOjamn++; return; }
        jpaYrken.push({
            yrke, nKv: g.kv.length, nMa: g.ma.length, tot: g.kv.length + g.ma.length,
            medKv: Math.round(medKv), medMa: Math.round(medMa),
            gapPct: +gapPct.toFixed(2),
            diffKr: Math.round(medKv - medMa)
        });
    });
    jpaYrken.sort((a, b) => a.gapPct - b.gapPct);  // mest negativa (mest kritiska) först

    // ---- B) Identifiera JPA-grupper (likvärdigt arbete = BAS-intervall) ----
    // OLS-regression per BAS, kräver minst statGolv() av varje kön
    const basList = [...new Set(d.map(r => r.bas))].sort();
    const perBas = _computePerBasGap(d, basList);
    let basExkluderadeMaskerade = 0;
    let basExkluderadeSingular = 0;
    let basExkluderadeUnderTröskel = 0;
    const jpaBas = [];
    perBas.forEach(b => {
        if (b.status === 'too_few')    { basExkluderadeMaskerade++; return; }
        if (b.status === 'singular')   { basExkluderadeSingular++; return; }
        if (Math.abs(b.gapPct) <= 5)   { basExkluderadeUnderTröskel++; return; }
        jpaBas.push(b);
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
        ['Antal yrkesgrupper där kvinnors och mäns median skiljer sig mer än 5 % (lika arbete)', jpaYrken.length],
        ['Antal BAS-intervall med >5% oförklarat gap (likvärdigt arbete)', jpaBas.length],
        [`Antal ${lvRedovisning.not ? 'redovisade ' : ''}kandidatpar i likvärdigt arbete (kvinnodominerat yrke mot icke-kvinnodominerat yrke med lika eller lägre krav)`, lvPairsCount],
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
        ['Detta protokoll ska bifogas arbetsgivarens lönekartläggning för året.', ''],
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

    // === Sheet 2: Yrkesgrupper med >5% gap (lika arbete) ===
    const yrkenHeaderRow = [
        'Nr', 'AID / Yrkesgrupp', 'N totalt', 'N kvinnor', 'N män',
        'Median kvinnor (kr)', 'Median män (kr)', 'Differens (kr)', 'Kvinnors median i % av mäns',
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
        yrkenRows.push(['—', 'Inga yrkesgrupper där kvinnors och mäns median skiljer sig mer än 5 %, efter k-anonymitet', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    } else {
        jpaYrken.forEach((j, idx) => {
            yrkenRows.push([
                idx + 1, j.yrke, j.tot, j.nKv, j.nMa,
                j.medKv, j.medMa, j.diffKr, typeof j.gapPct === 'number' ? +(100 + j.gapPct).toFixed(1) : j.gapPct,
                '', '', '', '', '', ''  // protokoll-celler tomma
            ]);
        });
    }
    const yrkenSheet = XLSX.utils.aoa_to_sheet(yrkenRows);
    yrkenSheet['!cols'] = [
        { wch: 4 }, { wch: 42 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 12 },
        { wch: 50 }, { wch: 50 }, { wch: 32 }, { wch: 40 }, { wch: 18 }, { wch: 22 }
    ];
    yrkenSheet['!freeze'] = { xSplit: 2, ySplit: 1 };
    _applyColumnNumFormats(yrkenSheet, SV_NUM_FORMATS);
    XLSX.utils.book_append_sheet(wb, yrkenSheet, '2. Lika arbete (yrken)');

    // === Sheet 3: BAS-intervall med >5% oförklarat gap (likvärdigt arbete) ===
    const basHeaderRow = [
        'Nr', 'BAS-intervall', 'N totalt', 'N kvinnor', 'N män',
        'Oförklarat gap (%)', '95% KI lägre', '95% KI övre',
        'p-värde', 'R² för modellen', 'Statistiskt säkerställd',
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
        basRows.push(['—', 'Inga BAS-intervall med oförklarat gap >5% efter k-anonymitet', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    } else {
        jpaBas.forEach((b, idx) => {
            basRows.push([
                idx + 1, b.bas, b.n, b.kvN, b.maN,
                +b.gapPct.toFixed(2), +b.ciLow.toFixed(2), +b.ciHigh.toFixed(2),
                b.pValue < 0.001 ? '< 0.001' : +b.pValue.toFixed(4),
                +(b.R2 * 100).toFixed(1) + '%',
                b.pValue < 0.05 ? 'Ja' : 'Nej',
                '', '', '', '', '', ''
            ]);
        });
    }
    const basSheet = XLSX.utils.aoa_to_sheet(basRows);
    basSheet['!cols'] = [
        { wch: 4 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
        { wch: 50 }, { wch: 50 }, { wch: 32 }, { wch: 40 }, { wch: 18 }, { wch: 22 }
    ];
    basSheet['!freeze'] = { xSplit: 2, ySplit: 1 };
    _applyColumnNumFormats(basSheet, SV_NUM_FORMATS);
    XLSX.utils.book_append_sheet(wb, basSheet, '3. Likvärdigt arbete (BAS)');

    // === Sheet 3b: § 3:10 Likvärdighet (kv-dom yrken vs icke-kv-dom yrken) ===
    // Använder lvResult som beräknats högst upp i
    // funktionen — så försättssidans räknare och tabellen i flik 3b alltid
    // är från samma compute.
    if (lvResult && lvResult.pairs.length && !lvRedovisning.par.length) {
        // Alla par har en grupp under tröskeln: arket anger det i stället för att tiga eller påstå att par saknas.
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[lvRedovisning.not]]), '3b. § 3-10 Likvärdighet');
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
            'Jämf. AID', 'Jämf. Yrke', 'Jämf. % kvinnor', 'Jämf. n', 'Jämförelsekälla', 'Median Jämf. (kr)',
            'Gap (kr)', 'Gap (%)', '95 % KI lägre (kr)', '95 % KI övre (kr)', 'Säkerhet', 'Påverkansindex',
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
            p.maAid, p.maLabel, +p.maKvAndel.toFixed(1), p.maN != null ? p.maN : '—', lvKälla(p), Math.round(p.maMedian),
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
            { wch: 8 }, { wch: 28 }, { wch: 12 }, { wch: 7 }, { wch: 20 }, { wch: 14 },
            { wch: 11 }, { wch: 8 }, { wch: 13 }, { wch: 13 }, { wch: 24 }, { wch: 14 },
            { wch: 50 }, { wch: 50 }, { wch: 28 }, { wch: 40 }, { wch: 18 }, { wch: 22 }
        ];
        lvSheet['!freeze'] = { xSplit: 3, ySplit: 1 };
        _applyColumnNumFormats(lvSheet, SV_NUM_FORMATS);
        // OBS: kolon är förbjudet i Excel-arknamn (SheetJS kastar) — därav "3-10".
        // Demodata saknar § 3:10-par, så arket prövas bara med riktiga par.
        XLSX.utils.book_append_sheet(wb, lvSheet, '3b. § 3-10 Likvärdighet');
    }

    // === Sheet 4: Exkluderade grupper (transparens om k-anonymitet) ===
    const excludedRows = [
        ['EXKLUDERADE GRUPPER — transparens för fackliga parter', ''],
        ['', ''],
        ['Inga personidentifierande uppgifter visas. Endast antal exkluderade grupper.', ''],
        ['', ''],
        ['Lika arbete (yrkesgrupper):', ''],
        [_jpaExkluderadeTexter().yrken, yrkenExkluderadeMaskerade],
        ['  Under 5%-tröskeln (rågap ≥ 5%)', yrkenExkluderadeOjamn],
        ['', ''],
        ['Likvärdigt arbete (BAS-intervall):', ''],
        [_jpaExkluderadeTexter().bas, basExkluderadeMaskerade],
        ['  Exkluderade p.g.a. singulär regression (multikollinearitet)', basExkluderadeSingular],
        ['  Under 5%-tröskeln (oförklarat gap ≥ 5%)', basExkluderadeUnderTröskel],
        ['', ''],
        ['Gränsen 5 % kommer från direktivets regler om gemensam lönebedömning (art. 10).', ''],
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
        ['Direktiv (EU) 2023/970, art. 10', 'Gemensam lönebedömning krävs hos arbetsgivare som lönerapporterar när skillnaden i någon kategori arbetstagare är 5 % eller mer, inte motiveras av objektiva könsneutrala kriterier och inte åtgärdats inom sex månader.'],
        ['Direktiv (EU) 2023/970, art. 10', 'Bedömningen görs tillsammans med arbetstagarrepresentanterna; åtgärder inom rimlig tid.'],
        ['Diskrimineringslagen, lönekartläggning', 'Löneskillnad ska kunna motiveras med sakliga skäl: arbetets svårighet, ansvar, krav på utbildning/erfarenhet eller andra särskilda omständigheter.'],
        ['Diskrimineringslagen, likvärdigt arbete', 'Likvärdigt arbete bedöms genom analys av krav som arbetet ställer (utbildning, ansvar, ansträngning, arbetsförhållanden).'],
        ['Diskrimineringslagen, kvinnodominerat arbete', 'Arbetsgivaren ska analysera om kvinnodominerade yrken har lägre lön än icke-kvinnodominerade yrken med likvärdiga eller lägre krav i arbetet. BAS-rank används i flik 3b som ordinal proxy för arbetskrav — slutgiltig kravvärdering kräver kvalitativ granskning.'],
        ['Diskrimineringslagen 3:11', 'Konstaterade osakliga löneskillnader ska åtgärdas så snart som möjligt, senast inom 3 år.'],
        ['', ''],
        ['— Statistisk metodik —', ''],
        ['Lika arbete (yrkesgrupp)', 'Direkt median-jämförelse mellan kvinnors och mäns löner inom samma AID-kod. Kvinnors median i procent av mäns = median_kv / median_mä × 100; under 100 betyder att kvinnor ligger lägre.'],
        ['Likvärdigt arbete (BAS-intervall)', 'OLS-regression: log(lön) ~ kön + ålder (centrerad) inom varje BAS. Oförklarat gap = kön-koefficient omräknad till procentskillnad. HC3-robusta standardfel (Long & Ervin 2000).'],
        ['Konfidensintervall', '95% KI = β ± t(0,975; n−k) × HC3 robust SE, transformerat tillbaka från log-skala; t-kvantilen är 1,96 vid n−k ≥ 100 och större vid färre frihetsgrader.'],
        ['Statistisk signifikans', 'p < 0.05 = ej slumpmässig skillnad. Tröskel följer Medlingsinstitutets praxis.'],
        ['', ''],
        ['— k-anonymitet —', ''],
        ['Tröskel', `n ≥ ${kTroskel()} per kön krävs för att en grupp ska redovisas individuellt.`],
        ['Bakgrund', 'Skydd mot återidentifiering av enskilda anställda via deduktion (kön + ålder + yrke + BAS).'],
        ['Konsekvens', 'Små grupper exkluderas helt från detta protokoll. Antal exkluderade redovisas i flik 4.'],
        ['', ''],
        ['— Begränsningar att vara medvetna om —', ''],
        ['Sakliga skäl', 'Verktyget identifierar löneskillnader men avgör inte vad som är saklig grund. Den bedömningen är gemensamma parters ansvar.'],
        ['Modellantaganden', 'OLS antar linjär samband mellan ålder och log(lön). Lifecycle-analysen (i verktygets EU-flik) testar detta antagande med kvadratisk åldersterm.'],
        ['Multipel jämförelse', 'Många p-värden testas samtidigt. Vid stort antal BAS-intervall förväntas 1 falskt positivt resultat per 20 tester av slump. Tolka p-värden i kontext.']
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
    announceToScreenReader(`Protokoll för gemensam lönebedömning exporterat: ${jpaYrken.length} yrkesgrupp${jpaYrken.length === 1 ? '' : 'er'} och ${jpaBas.length} BAS-intervall över 5%-tröskeln.`);
}

// Multi-flik Excel-export
document.getElementById("btn-export-all-excel")?.addEventListener("click", exportAllToExcel);

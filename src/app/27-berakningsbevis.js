// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Bevis-popup för fynd -------------
//
// Generaliserad modal som visar hur en siffra beräknats: formel,
// ingångsvärden, mellansteg. Försvarsmaterial för facklig samråd.
//
// Anropas med ett payload-objekt som beskriver fyndet:
//   { type, title, rows: [{label, value, note?}], formula?, footer? }
//
// type-prefix används bara för intern logg/sökning, alla typer
// renderas med samma layout.

/**
 * Öppnar bevis-modal och fyller den med ett formaterat innehåll.
 * @param {Object} p
 * @param {string} p.title    - rubrik
 * @param {Array}  p.rows     - {label, value, note?} per rad
 * @param {string} [p.formula] - HTML-formel (kan innehålla <code>, <em>)
 * @param {string} [p.intro]   - inledande förklaring
 * @param {string} [p.footer]  - tolkningskommentar
 */
function _openEvidenceModal(p) {
    const modal = document.getElementById('evidence-modal');
    const content = document.getElementById('evidence-modal-content');
    const titleEl = document.getElementById('evidence-modal-title');
    if (!modal || !content) return;
    if (titleEl && p.title) titleEl.textContent = '' + p.title;

    const rowsHtml = (p.rows || []).map(r => {
        const valHtml = r.isHtml ? r.value : esc(r.value);
        const note = r.note ? `<div class="text-dampad-xs marg-t-2">${esc(r.note)}</div>` : '';
        return `<tr>
            <td class="ram-b-1-kant pad-6-10"><strong>${esc(r.label)}</strong></td>
            <td class="ram-b-1-kant tabelltal pad-6-10 ta-hoger">${valHtml}${note}</td>
        </tr>`;
    }).join('');

    content.innerHTML = `
        ${p.intro ? `<p class="fs-md lh-1_55 marg-0-0-12">${p.intro}</p>` : ''}
        <table class="tabell-samman fs-sm bredd-100p">
            <tbody>${rowsHtml}</tbody>
        </table>
        ${p.formula ? `<div class="bak-yta ram-v-3-granska-ljus rund-4 typsnitt-mono-ui fs-sm lh-1_5 marg-t-14 pad-10-12">${p.formula}</div>` : ''}
        ${p.footer ? `<p class="text-dampad-sm lh-1_55 marg-14-0-0">${p.footer}</p>` : ''}
    `;
    modal.style.display = 'flex';
    if (typeof trapFocus === 'function') trapFocus(modal);
}

function _closeEvidenceModal() {
    const modal = document.getElementById('evidence-modal');
    if (!modal) return;
    if (typeof releaseFocus === 'function') releaseFocus(modal);
    modal.style.display = 'none';
}

// Stäng-handlers + Esc-tangent
document.addEventListener('click', e => {
    if (/** @type {HTMLElement} */ (e.target).closest('[data-evidence-close]')) _closeEvidenceModal();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('evidence-modal')?.style.display === 'flex') {
        _closeEvidenceModal();
    }
});

/**
 * Bygger bevis-payload för ett § 3:10-par.
 * @param {Object} p - par-objekt från computeLikvardighetPairs
 */
function _evidenceForLikvardighetPair(p) {
    const fmtKr = v => Math.round(v).toLocaleString('sv-SE') + ' kr';
    const fmtN = v => v.toLocaleString('sv-SE');
    const alderText = v => typeof v === 'number' && isFinite(v) ? svTal(v, 0) : '–';
    const sigStatus = p.gapCI
        ? (p.gapCI.lo > 0 ? 'Säker skillnad — värt att granska' : 'Inom slumpfel')
        : '— Ej beräkningsbar';
    const ärIntern = p.jamforKalla === 'intern';
    const jämförKällaText = ärIntern
        ? 'organisationens egna data (icke-kvinnodominerat yrke)'
        : 'jämförelsestatistiken (icke-kvinnodominerat)';
    // Bootstrap-metoden skiljer sig per källa: intern = bägge individurvalen,
    // extern = organisationens löner mot jämförelsestatistikens median som konstant.
    const ciNote = ärIntern
        ? 'Bootstrap på bägge individurvalen (org. kv-dom + org. jämförelseyrke), B=1000'
        : 'Bootstrap mot konstant jämförelsestatistikens median, B=1000 omdragningar av organisationens löner';
    return {
        title: `Bevis — ${p.kvLabel || p.kvAid} mot ${p.maLabel || p.maAid}`,
        intro: `Detta par flaggades i likvärdighetsanalysen: <strong>${esc(p.kvLabel || p.kvAid)}</strong> i organisationen (kvinnodominerat) har lägre medianlön än <strong>${esc(p.maLabel || p.maAid)}</strong> i ${jämförKällaText} inom <em>samma BAS-intervall</em> (= likvärdiga krav). ${ärIntern ? 'Detta är en <strong>inom-arbetsgivare-jämförelse</strong> — bägge yrkena finns i organisationen.' : 'Internt jämförelseyrke saknades i denna BAS, därför används jämförelsestatistiken som extern proxy.'} Tabellraden visar n, medianer och gap — nedan visas <em>hur</em> klassning och säkerhet räknats fram.`,
        rows: [
            // Endast det som INTE redan står i tabellraden: varför jämförelseyrket räknas
            // som icke-kvinnodominerat, hur säkerheten bedöms, och vad påverkansindex betyder.
            { label: 'Varför jämförbart yrke?',
              value: ärIntern ? 'Organisationens eget yrke (intern)' : (p.maKlassKort === 'lokal' ? 'Faktisk könsfördelning (jämförelsestatistiken)' : `Nationell könsfördelning som reserv (${skrKallaKort()})`),
              note: ärIntern
                ? `${svPct(p.maKvAndel, 0)} kvinnor i organisationen’s grupp${p.maN != null ? ` (n=${p.maN})` : ''}: icke-kvinnodominerat`
                : (p.maKlassKort === 'lokal'
                    ? `${svPct(p.maKvAndel, 0)} kvinnor${p.maNKv != null && p.maNMa != null ? ` (${p.maNKv} kv / ${p.maNMa} mä)` : ''}: under 40 % = icke-kvinnodominerat`
                    : `${svPct(p.maKvAndel, 0)} kvinnor på nationell nivå: under 40 % = icke-kvinnodominerat. Lokal könsdata saknades.`) },
            { label: '95 % säkerhetsintervall (gap)',      value: p.gapCI ? `[${fmtKr(p.gapCI.lo)}, ${fmtKr(p.gapCI.hi)}]` : '—', note: p.gapCI ? ciNote : 'För få observationer i organisationen för bootstrap' },
            { label: 'Säkerhetsbedömning',                 value: sigStatus, isHtml: true, note: p.gapCI ? (p.gapCI.lo > 0 ? 'Hela intervallet > 0, alltså är skillnaden inte slumpmässig' : 'Intervallet rör vid 0, alltså kan det vara slump') : '' },
            { label: 'Påverkansindex',                     value: fmtN(Math.round(p.allvarsindex)), note: `|gap| × n (i organisationen) = ${fmtKr(Math.abs(p.gapKr))} × ${p.kvN} — heuristik som rangordnar par efter total löneeffekt (ej lagstadgat mått)` },
            { label: 'Medelålder',                         value: `${alderText(p.kvMedelAlder)} år mot ${alderText(p.maMedelAlder)} år`, note: 'Det kvinnodominerade yrket mot jämförelseyrket. Skiljer sig åldrarna mycket kan en del av skillnaden vara åldersstruktur.' },
            { label: 'Justerad för ålder',                 value: p.aldersJusterad ? svPct(p.aldersJusterad.gapPct, 1) : '—',
              note: p.aldersJusterad
                ? `Jämförelseyrkets lön omräknad till det kvinnodominerade yrkets åldersfördelning ger medianen ${fmtKr(p.aldersJusterad.medianJusterad)}, ${fmtKr(p.aldersJusterad.gapKr)} över ${fmtKr(p.kvMedian)}. Den råa skillnaden är det lagen prövar; den justerade visar hur mycket som kan bero på åldersstruktur.`
                : (ärIntern ? 'Kunde inte räknas: jämförelseyrket har för få personer med ålder eller för liten åldersspridning.' : 'Räknas bara för interna par — jämförelsestatistiken saknar individdata.') }
        ],
        formula: `<strong>Beräkning:</strong><br>
            gap (kr) = median(jämförelseyrke) − median(organisation)<br>
            = ${fmtKr(p.maMedian)} − ${fmtKr(p.kvMedian)} = <strong>${fmtKr(p.gapKr)}</strong><br>
            gap (%) = gap / median(organisation) × 100<br>
            = ${fmtKr(p.gapKr)} / ${fmtKr(p.kvMedian)} × 100 = <strong>${svPct(p.gapPct, 2)}</strong><br><br>
            <strong>Klassificering av jämförelseyrket (icke-kvinnodominerat):</strong><br>
            ${ärIntern
                ? `Källa: organisationens egna individdata (faktisk könsfördelning per AID×BAS)<br>${svPct(p.maKvAndel, 1)} kvinnor${p.maN != null ? ` (n=${p.maN})` : ''}: icke-kvinnodominerat`
                : (p.maKlassKort === 'lokal'
                    ? `Källa: jämförelsestatistiken (faktisk könsfördelning per AID×BAS)<br>${svPct(p.maKvAndel, 1)} kvinnor${p.maNKv != null && p.maNMa != null ? ` (${p.maNKv} kvinnor av ${p.maNKv + p.maNMa} totalt)` : ''}: under 40 % = icke-kvinnodominerat`
                    : `Källa: ${esc(_skrReferensInfo().kalla)} (nationell reserv)<br>AID ${esc(p.maAid)}: ${p.maKvAndel.toFixed(1).replace('.', ',')} % kvinnor i ${_skrDelText(_skrDel())}: under 40 % = icke-kvinnodominerat`)}`,
        footer: `Verktyget identifierar statistiska kandidater. Den slutliga bedömningen — om kraven verkligen är likvärdiga och om det finns sakliga skäl — görs manuellt i lönekartläggningsrapporten.${p.maKlassKort === 'SCB' ? ' SKR:s kvinnoandel är nationell; jämförelsestatistikens faktiska könsfördelning per AID kan avvika och bör verifieras vid behov.' : ''}`
    };
}

/**
 * Bygger bevis-payload för en prio-rad.
 * @param {Object} it - item från computePrioritization
 * @param {string} _reference - 'stallningstagande' eller 'statistik' (f.n. ej använd i beviset)
 */
function _evidenceForPrioItem(it, _reference) {
    const fmtKr = v => Math.round(v).toLocaleString('sv-SE') + ' kr';
    const fmtN = v => v.toLocaleString('sv-SE');
    const w = state.prioWeights;
    const wTotal = Math.max(1, w.avvikelse + w.volym + w.jamstalldhet);
    const sevScore  = Math.min(30, Math.abs(it.diffPct)) / 30 * 100;
    const volScore  = Math.min(50, it.n) / 50 * 100;
    const gapScore  = it.gapPct !== null ? Math.min(15, Math.abs(it.gapPct)) / 15 * 100 : 0;
    const directionWeight = it.diffPct < 0 ? 1.0 : 0.5;
    const bristMultiplier = it.isBrist ? 1.2 : 1.0;
    const months  = state.costSettings?.months || 12;
    const poPct   = state.costSettings?.poPct  || 0;
    const poFactor = 1 + poPct / 100;
    const sgn = v => v >= 0 ? '+' : '';

    return {
        title: `Bevis — ${it.yrke} · BAS ${it.bas}`,
        intro: `Detta är en av <strong>${it.n}</strong> personer i gruppen <em>${esc(it.yrke)}</em> (BAS ${esc(it.bas)}). Prioritetsindex beräknas från avvikelse mot ${esc(it.refSource)}, gruppvolym och köns-lönegap inom gruppen.`,
        rows: [
            { label: 'Antal medarbetare i gruppen', value: fmtN(it.n), note: `${it.kvN} kvinnor · ${it.maN} män` },
            { label: 'Median månadslön',            value: fmtKr(it.median) },
            { label: `Referens (${it.refSource})`,  value: fmtKr(it.refMedian) },
            { label: 'Avvikelse',                   value: `${sgn(it.diffPct)}${svPct(it.diffPct, 2)}  (${sgn(it.diffKr)}${fmtKr(it.diffKr)})` },
            { label: 'Köns-lönegap inom gruppen',   value: it.gapPct == null ? '— ej beräkningsbart' : `${sgn(it.gapPct)}${svPct(it.gapPct, 2)}`, note: it.gapPct == null ? `Kräver minst ${kTroskel()} av varje kön` : `Median kv ${fmtKr(it.medKv)} mot median man ${fmtKr(it.medMa)}` },
            { label: '— Prioritetsindex',           value: `<strong>${svTal(it.priorityIndex, 1)}</strong>`, isHtml: true, note: `Status: ${it.status.toUpperCase()}` },
            { label: 'Avvikelse-poäng (sev)',       value: svTal(sevScore, 1), note: `min(30, |${svPct(it.diffPct, 1)}|) / 30 × 100 · vikt ${w.avvikelse}/${wTotal}` },
            { label: 'Volym-poäng (vol)',           value: svTal(volScore, 1), note: `min(50, ${it.n}) / 50 × 100 · vikt ${w.volym}/${wTotal}` },
            { label: 'Jämställdhets-poäng (gap)',   value: svTal(gapScore, 1), note: `min(15, |${it.gapPct == null ? 0 : svTal(it.gapPct, 1)} %|) / 15 × 100 · vikt ${w.jamstalldhet}/${wTotal}` },
            { label: 'Riktningsvikt',               value: svTal(directionWeight, 2), note: it.diffPct < 0 ? 'Gruppen ligger UNDER referens — full vikt 1,0' : 'Gruppen ligger ÖVER referens — halv vikt 0,5' },
            { label: 'Bristyrke-multiplikator',     value: svTal(bristMultiplier, 2), note: it.isBrist ? 'Markerat som bristyrke — bonus 1,2x' : 'Ej bristyrke' },
            { label: '— Total kostnad',             value: it.annualGapTotal > 0 ? `<strong>${fmtKr(it.annualGapTotal)}</strong>` : '— (gruppen är ej under referens)', isHtml: true, note: `${months} mån × PO-påslag ${svPct(poPct, 2)} × ${it.n} pers` }
        ],
        formula: `<strong>Prioritetsindex-formel:</strong><br>
            index = bristMult × riktningMult × (sev × w_avv + vol × w_vol + gap × w_jäm) / Σw<br>
            = ${svTal(bristMultiplier, 2)} × ${svTal(directionWeight, 2)} × (${svTal(sevScore, 1)} × ${w.avvikelse}/${wTotal} + ${svTal(volScore, 1)} × ${w.volym}/${wTotal} + ${svTal(gapScore, 1)} × ${w.jamstalldhet}/${wTotal})<br>
            = <strong>${svTal(it.priorityIndex, 2)}</strong>
            ${it.annualGapTotal > 0 ? `<br><br><strong>Kostnad att lyfta till referens:</strong><br>
            |Δkr| × ${months} mån × PO-faktor × n = ${fmtKr(Math.abs(it.diffKr))} × ${months} × ${svTal(poFactor, 4)} × ${it.n} = <strong>${fmtKr(it.annualGapTotal)}</strong>` : ''}`,
        footer: `Vikterna (${w.avvikelse}/${w.volym}/${w.jamstalldhet}) konfigureras i Prioriteringsflikens "Trösklar & vikter"-sektion. Kostnaden inkluderar arbetsgivaravgifter (PO-påslag ${svPct(poPct, 2)}).`
    };
}

/**
 * Bevis-payload för en EU-matris-rad (yrkesgrupps-jämförelse).
 * @param {Object} r - rad från EU-matris-aggregering
 */
function _evidenceForEUMatrixRow(r) {
    const fmtKr = v => Math.round(v).toLocaleString('sv-SE') + ' kr';
    const ratio = r.medKv / r.medMa;
    const gapSgn = ratio - 1;
    const gapPct = gapSgn * 100;
    return {
        title: `Bevis — ${r.yrke}`,
        intro: `Jämförelse av medianlöner mellan kvinnor och män inom samma yrkesgrupp (lika arbete enligt diskrimineringslagen). Inga statistiska kontroller görs här; det är en direkt median-jämförelse.`,
        rows: [
            { label: 'Yrkesgrupp',                value: r.yrke },
            { label: 'Antal medarbetare totalt',  value: r.tot.toLocaleString('sv-SE') },
            { label: 'Antal kvinnor',             value: r.nKv.toLocaleString('sv-SE'), note: r.kMaskedKv ? `Maskerad — under k=${kTroskel()}` : '' },
            { label: 'Antal män',                 value: r.nMa.toLocaleString('sv-SE'), note: r.kMaskedMa ? `Maskerad — under k=${kTroskel()}` : '' },
            { label: 'Könsdominans',              value: r.dominans },
            { label: 'Median kvinnor',            value: r.kMaskedKv ? `< ${kTroskel()} pers (maskerad)` : fmtKr(r.medKv) },
            { label: 'Median män',                value: r.kMaskedMa ? `< ${kTroskel()} pers (maskerad)` : fmtKr(r.medMa) },
            { label: '— Mediankvot',              value: r.anyMasked ? '—' : `${svTal(ratio, 4)} (Kv/Man)` },
            { label: 'Lönegap',                   value: r.anyMasked ? '—' : `${gapSgn >= 0 ? '+' : ''}${svPct(gapPct, 2)}` }
        ],
        formula: r.anyMasked ? '<em>Gruppen är k-maskerad — ingen jämförelse görs.</em>' :
            `<strong>Beräkning:</strong><br>
            kvot = median(kvinnor) / median(män) = ${fmtKr(r.medKv)} / ${fmtKr(r.medMa)} = <strong>${svTal(ratio, 4)}</strong><br>
            gap = (kvot − 1) × 100 = (${svTal(ratio, 4)} − 1) × 100 = <strong>${svPct(gapPct, 2)}</strong>`,
        footer: `Denna jämförelse gäller lika arbete enligt diskrimineringslagen — samma yrke, oberoende av övriga karakteristika. För "likvärdigt arbete" (annan yrke, samma krav), se EU-matrisens BAS-tabell eller fliken Likvärdigt arbete.`
    };
}

/**
 * Bevis-payload för en per-BAS-regressionsrad (Lika-värt-arbete inom BAS).
 * @param {Object} p - {bas, n, kvN, maN, status, gapPct, ciLow, ciHigh, pValue, R2}
 * @param {Object} [bhCtx] - {q, allM} BH-FDR-context: justerat q-värde + total antal tester
 */
function _evidenceForPerBasRow(p, bhCtx) {
    const fmtPct = v => (v >= 0 ? '+' : '') + svPct(v, 2);
    if (p.status !== 'ok') {
        return {
            title: `Bevis — BAS ${p.bas}`,
            intro: p.status === 'too_few'
                ? `Per-BAS-regression kunde inte köras eftersom underlaget är för litet (k-anonymitet).`
                : `Per-BAS-regression misslyckades på grund av multikollinearitet (singulär designmatris — typiskt om alla i gruppen har samma BAS-rang och ålder är extremt korrelerad med kön).`,
            rows: [
                { label: 'BAS-intervall', value: p.bas },
                { label: 'Antal totalt',   value: (p.n || 0).toLocaleString('sv-SE') },
                { label: 'Antal kvinnor',  value: (p.kvN || 0).toLocaleString('sv-SE'), note: (p.kvN || 0) < statGolv() ? `Under k=${statGolv()}` : '' },
                { label: 'Antal män',      value: (p.maN || 0).toLocaleString('sv-SE'), note: (p.maN || 0) < statGolv() ? `Under k=${statGolv()}` : '' },
                { label: 'Status',         value: p.status === 'too_few' ? 'För få observationer' : 'Singulär designmatris' }
            ]
        };
    }
    const isSig = p.pValue < 0.05;
    const sigAfterBH = bhCtx && bhCtx.q != null ? (p.pValue < 0.05 && bhCtx.q < 0.05) : isSig;
    const bhNote = bhCtx && bhCtx.q != null
        ? `BH-FDR-justerat q = ${bhCtx.q < 0.001 ? '< 0,001' : svTal(bhCtx.q, 4)} (${bhCtx.allM} parallella tester)`
        : 'Ingen multipel-jämförelse-korrigering (endast 1 BAS-test körs)';
    return {
        title: `Bevis — BAS ${p.bas} (per-BAS-regression)`,
        intro: `Inom BAS ${p.bas} kör vi en regression: <code>ln(lön) = β₀ + β_kön · Kvinna + β_ålder · (ålder − medel) + ε</code>. β_kön omräknat till procent ger lönegapet efter att skillnad i åldersfördelning kontrollerats för.`,
        rows: [
            { label: 'BAS-intervall',          value: p.bas },
            { label: 'Antal totalt',           value: p.n.toLocaleString('sv-SE') },
            { label: 'Antal kvinnor / män',    value: `${p.kvN} / ${p.maN}` },
            { label: '— Oförklarat lönegap',   value: `<strong>${fmtPct(p.gapPct)}</strong>`, isHtml: true, note: 'Efter kontroll för åldersskillnader' },
            { label: '95 % konfidensintervall', value: `[${fmtPct(p.ciLow)}, ${fmtPct(p.ciHigh)}]`, note: 'β ± t(0,975; n−k) × HC3-SE (1,96 vid n−k ≥ 100), transformerat tillbaka från log' },
            { label: 'p-värde',                value: p.pValue < 0.001 ? '< 0,001' : svTal(p.pValue, 4), note: isSig ? 'Statistiskt signifikant (p < 0,05)' : 'Ej signifikant' },
            { label: 'BH-FDR-korrektion',      value: bhCtx && bhCtx.q != null ? (bhCtx.q < 0.001 ? '< 0,001' : svTal(bhCtx.q, 4)) : '—', note: bhNote },
            { label: 'Klassning',              value: sigAfterBH && Math.abs(p.gapPct) > 5 ? 'Värt att granska' : sigAfterBH ? 'Signifikant, under 5 %-tröskeln' : 'Inom statistisk osäkerhet', isHtml: true },
            { label: 'R² (modellanpassning)',  value: svPct((p.R2 * 100), 1) }
        ],
        formula: `<strong>Statistisk metod:</strong><br>
            Modell: ln(lön) ~ kön + ålder (centrerad)<br>
            Standardfel: HC3-robusta (Long & Ervin 2000)<br>
            p-värde: 2-sidigt; t-fördelning med df = n − k vid små underlag (df &lt; 100), annars normal<br>
            gap % = (exp(β_kön) − 1) × 100 = (exp(${svTal((Math.log(1 + p.gapPct / 100)), 4)}) − 1) × 100 = <strong>${svPct(p.gapPct, 2)}</strong>`,
        footer: `BH-FDR-korrektionen ${bhCtx && bhCtx.q != null ? `justerar för att ${bhCtx.allM} parallella tester körs samtidigt — skyddar mot falska positiva. ` : ''}Klassificeringen "Bör utredas" kräver både p < 0,05 (efter BH) och |gap| > 5 % (gränsen i EU:s lönetransparensdirektiv). Sakliga skäl-analysen sker manuellt i Word-mallen.`
    };
}

/**
 * Bevis-payload för en rad i Löneöversikten (yrkesgrupp/kön/organisation).
 * @param {Object} p - { kategori, bas, lons, polRow, statRefMedian, masked }
 */
function _evidenceForRapportRow(p) {
    const fmtKr = v => v == null ? '—' : Math.round(v).toLocaleString('sv-SE') + ' kr';
    const n = (p.lons || []).length;
    const masked = !!p.masked;
    const med = masked || !n ? null : Stat.median(p.lons);
    const p10 = masked || !n ? null : Stat.quantile(p.lons, 0.1);
    const p90 = masked || !n ? null : Stat.quantile(p.lons, 0.9);
    const spread = (p10 != null && p10 > 0 && p90 != null) ? p90 / p10 : null;
    const statDiffPct = (med != null && p.statRefMedian) ? ((med / p.statRefMedian) - 1) * 100 : null;

    /** @type {Array<{label: string, value: string, isHtml?: boolean, note?: string}>} */

    const rows = [
        { label: 'Kategori',                value: p.kategori },
        { label: 'BAS-intervall',           value: p.bas },
        { label: 'Antal medarbetare',       value: n.toLocaleString('sv-SE'), note: masked ? `Maskerad — under k=${kTroskel()}` : '' }
    ];
    if (masked) {
        rows.push({ label: 'Statistik',     value: 'Maskerad pga k-anonymitet', note: 'Skyddar mot återidentifiering vid små grupper' });
    } else {
        rows.push(
            { label: 'P10 (10:e percentilen)', value: fmtKr(p10),                note: '10 % tjänar mindre än detta' },
            { label: 'Median (P50)',          value: fmtKr(med) },
            { label: 'P90 (90:e percentilen)', value: fmtKr(p90),                note: '90 % tjänar mindre än detta' },
            { label: 'Lönespridning',         value: spread != null ? svTal(spread, 2) : '—', note: 'P90 / P10 — högre värde = bredare spridning' }
        );
    }
    if (p.polRow) {
        rows.push({ label: `— ${referensNamn()}`,  value: '' });
        rows.push({ label: 'Policy-P10',  value: fmtKr(p.polRow.p10) });
        rows.push({ label: 'Policy-median', value: fmtKr(p.polRow.med) });
        rows.push({ label: 'Policy-P90',  value: fmtKr(p.polRow.p90) });
        if (med != null && p.polRow.p10 && med < p.polRow.p10) {
            rows.push({ label: 'Varning',  value: 'Median ligger UNDER policy-P10 (varningsfärg i tabellen)', isHtml: true });
        }
    }
    if (p.statRefMedian && !masked) {
        rows.push({ label: `— ${jmfNamn('Jämförelsestatistik')}`,          value: '' });
        rows.push({ label: `Median i ${jmfNamn('jämförelsestatistiken')}`,                value: fmtKr(p.statRefMedian) });
        rows.push({ label: `Skillnad mot ${jmfNamn('jämförelsestatistiken')}`,          value: (statDiffPct != null && statDiffPct >= 0 ? '+' : '') + svPct(statDiffPct, 2), note: '(organisationens median / referens) − 1' });
    }

    return {
        title: `Bevis — ${p.kategori} · BAS ${p.bas}`,
        intro: `Beräkningarna är direkt median/percentil från lönerna i denna grupp. Ingen modell, ingen kontroll — bara aggregat. Lönepolitiskt ställningstagande och jämförelsestatistiken visas som referenslinjer om de är uppladdade.`,
        rows,
        formula: masked ? '<em>Gruppen är k-maskerad — siffror visas ej.</em>' :
            `<strong>Direktberäkningar:</strong><br>
            Median (P50) = mittenvärdet av sorterade löner = <strong>${fmtKr(med)}</strong><br>
            P10 = värdet vid 10:e percentilen = <strong>${fmtKr(p10)}</strong><br>
            P90 = värdet vid 90:e percentilen = <strong>${fmtKr(p90)}</strong><br>
            Lönespridning = P90 / P10 = ${fmtKr(p90)} / ${fmtKr(p10)} = <strong>${spread != null ? svTal(spread, 2) : '—'}</strong>`,
        footer: `Detta är en deskriptiv vy — inga statistiska tester eller kontroller görs här. För regressionsanalys (oförklarat gap, ålders-/BAS-kontroll), se fliken Lika arbete.`
    };
}

/**
 * Bevis-payload för en rad i Skevhet-flikens lönegap-tabell (paygap-table).
 * @param {Object} p - { bas, kvLons, maLons, masked }
 */
function _evidenceForPaygapRow(p) {
    const fmtKr = v => v == null ? '—' : Math.round(v).toLocaleString('sv-SE') + ' kr';
    const nKv = (p.kvLons || []).length;
    const nMa = (p.maLons || []).length;
    if (p.masked) {
        return {
            title: `Bevis — BAS ${p.bas}`,
            intro: `Lönegapet för denna BAS är k-maskerad eftersom något kön har färre än ${kTroskel()} personer.`,
            rows: [
                { label: 'BAS-intervall',     value: p.bas },
                { label: 'Antal kvinnor',     value: nKv.toLocaleString('sv-SE'), note: nKv < kTroskel() ? `< k=${kTroskel()}` : '' },
                { label: 'Antal män',         value: nMa.toLocaleString('sv-SE'), note: nMa < kTroskel() ? `< k=${kTroskel()}` : '' },
                { label: 'Status',            value: 'Maskerad — minsta gruppstorlek för redovisning' }
            ],
            footer: 'Maskeringen skyddar mot återidentifiering av enskilda individer via deduktion (kön + BAS + lön).'
        };
    }
    const medKv = Stat.median(p.kvLons);
    const medMa = Stat.median(p.maLons);
    const ratio = medMa > 0 ? medKv / medMa : null;
    const gapPct = ratio != null ? (ratio * 100) : null;
    const diff100 = gapPct != null ? gapPct - 100 : null;
    const isCrit = diff100 != null && Math.abs(diff100) > 5;
    return {
        title: `Bevis — BAS ${p.bas}`,
        intro: `Lönegapet beräknas som <em>kvinnors median ÷ mäns median × 100 %</em>. 100 % = lika lön. Inget ålders- eller yrkesfilter — direkt median-jämförelse inom BAS-intervallet.`,
        rows: [
            { label: 'BAS-intervall',           value: p.bas },
            { label: 'Antal kvinnor',           value: nKv.toLocaleString('sv-SE') },
            { label: 'Antal män',               value: nMa.toLocaleString('sv-SE') },
            { label: 'Median kvinnor',          value: fmtKr(medKv) },
            { label: 'Median män',              value: fmtKr(medMa) },
            { label: '— Kvinna i % av Man',     value: svPct(gapPct, 2) },
            { label: 'Avvikelse från 100 %',    value: (diff100 != null && diff100 >= 0 ? '+' : '') + svTal(diff100, 2) + ' pp' },
            { label: 'Klassning',               value: isCrit ? 'Värt att granska (över 5 %) — här aktualiseras EU-direktivets utredningssteg (2023/970)' : Math.abs(diff100 ?? 0) > 3 ? 'Följ upp (3–5 %)' : 'Balanserat (högst 3 %)', isHtml: true }
        ],
        formula: `<strong>Beräkning:</strong><br>
            kvot = median(kvinnor) / median(män) = ${fmtKr(medKv)} / ${fmtKr(medMa)} = <strong>${svTal(ratio, 4)}</strong><br>
            Kvinna % av Man = kvot × 100 = <strong>${svPct(gapPct, 2)}</strong>`,
        footer: `Det här är ett "rågap" inom BAS — ingen kontroll för ålder eller yrke. För kontrollerat oförklarat gap, se per-BAS-regressionsraden i fliken Lika arbete.`
    };
}


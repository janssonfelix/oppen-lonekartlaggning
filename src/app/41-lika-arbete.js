// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Skevhet ----
// Översiktens rader: kvinnors och mäns medianlön per BAS-intervall med kvoten och dess 95-procentiga bootstrap-KI.
// EN beräkning för skärmens tabell, diagrammen och rapporten (Word, PDF) — de kan därför aldrig visa olika tal.
// Bara BAS-intervall där BÅDA könen når tröskeln får en rad: varje tal i raden bygger på minst k personer.
// Bootstrap med B = 1000, seedad ur datat så att intervallet blir detsamma varje gång; medianen räknas med
// quickselect (O(n) — sortering tar några sekunder vid 20 000 rader).
function _laBootstrapGapCI(kvLons, maLons, B = 1000) {
    if (kvLons.length < 3 || maLons.length < 3) return null;
    const ratios = new Array(B);
    const kvN = kvLons.length, maN = maLons.length;
    const rnd = _rngFor(kvLons, maLons);   // seedad ur datat → reproducerbart KI
    for (let b = 0; b < B; b++) {
        const sKv = new Array(kvN), sMa = new Array(maN);
        for (let i = 0; i < kvN; i++) sKv[i] = kvLons[(rnd() * kvN) | 0];
        for (let i = 0; i < maN; i++) sMa[i] = maLons[(rnd() * maN) | 0];
        const mKv = _quickMedian(sKv);
        const mMa = _quickMedian(sMa);
        ratios[b] = mMa > 0 ? (mKv / mMa) * 100 : 100;
    }
    ratios.sort((a, b) => a - b);
    return { lo: ratios[Math.floor(B * 0.025)], hi: ratios[Math.floor(B * 0.975)] };
}
// Översiktens rader och trattdiagrammets underlag är dyra (bootstrap respektive omkastning: på 55 000 rader 0,8 s
// och 1,8 s) och behövs av flera vyer — fliken, rapportmodellen (som byggs flera gånger i Dokumentera) och
// exporterna. De räknas därför EN gång per underlag och tröskel. Skärmläget och exportläget (ADR-51) har olika
// tröskel och var sitt minne, så att ett byte av läge inte räknar om; ett annat underlag tömmer båda. Minnet håller
// en referens till dataraderna och släpps när statistiken ogiltigförklaras och när all data rensas (laMinneSlapp),
// så att inget ligger kvar.
/** @type {Map<number, {d: any[], n: number, k: number, [k: string]: any}>} */
const _laMinnen = new Map();
function _laMinneFor(d, k) {
    const forsta = _laMinnen.values().next().value;
    if (forsta && (forsta.d !== d || forsta.n !== d.length)) _laMinnen.clear();
    let m = _laMinnen.get(k);
    if (!m) { m = { d, n: d.length, k }; _laMinnen.set(k, m); }
    return m;
}
function laMinneSlapp() { _laMinnen.clear(); }
function _laOversiktRader(d, bas = getBasIntervals(), k = kTroskel()) {
    const minne = _laMinneFor(d, k), nyckel = bas.join('\u0000');
    if (minne.oversikt && minne.oversiktNyckel === nyckel) return minne.oversikt;
    const ut = _laOversiktRaderRakna(d, bas, k);
    minne.oversikt = ut; minne.oversiktNyckel = nyckel;
    return ut;
}
function _laOversiktRaderRakna(d, bas, k) {
    const ut = [];
    for (const b of bas) {
        const df = d.filter(r => r.bas === b);
        const kv = df.filter(r => r.kon.includes('kvinna')), ma = df.filter(r => r.kon === 'man' || r.kon === 'män');
        if (kv.length < k || ma.length < k) continue;
        const medKv = Stat.median(kv.map(r => r.lon)), medMa = Stat.median(ma.map(r => r.lon));
        ut.push({ bas: b, gap: medKv / medMa * 100, n: df.length, ci: _laBootstrapGapCI(kv.map(r => r.lon), ma.map(r => r.lon)), medKv, medMa, nKv: kv.length, nMa: ma.length });
    }
    return ut;
}
/** Radens status i ord, med samma gränser som översiktens symboler (över 5 %, 3–5 %, inom 3 %). */
function _laOversiktStatus(o) { return _SKEVHET_STATUS.find(s => s.galler(Math.abs(100 - o.gap))) || _SKEVHET_STATUS[_SKEVHET_STATUS.length - 1]; }

function generateSkevhet() {
    const fmt = new Intl.NumberFormat('sv-SE', {style:'currency',currency:'SEK',maximumFractionDigits:0});
    const d   = getData();
    const bas = getBasIntervals();

    const overviewEl = document.getElementById('chart-skevhet-overview');
    if (overviewEl) {
        const bars = _laOversiktRader(d, bas);
        // Anteckningen i exportbilden: BAS-intervallet med störst skillnad, bland dem som visas.
        const storst = bars.slice().sort((a, b) => Math.abs(100 - b.gap) - Math.abs(100 - a.gap))[0];
        if (bars.length) ritaFigur(overviewEl, _skevhetFigur(bars), { exportAnteckning: `Störst skillnad: BAS ${storst.bas}, kvinnors median ${_figTalformat(storst.gap, 'pct')} av männens` });
        else rensaFigur(overviewEl);
        _laOversiktTabell(bars);
        // Spridningen bakom medianerna: en låda per kön i varje BAS-intervall (samma figur som fliken Ålder & karriär
        // ritar som täthetskurvor, här som lådor). Ett kön under tröskeln i ett intervall ritas inte.
        const ladEl = document.getElementById('chart-skevhet-lador');
        if (ladEl) {
            const { figur, utelamnade } = _konTathetFigur(d, true, kTroskel(), 'lada');
            if (figur.lager.length) ritaFigur(ladEl, figur, { tomtext: `Inget BAS-intervall har minst ${kTroskel()} personer av ett kön.` }); else rensaFigur(ladEl);
            const not = document.getElementById('skevhet-lador-not');
            if (not) { not.hidden = !utelamnade.length; not.textContent = utelamnade.length ? `Visas inte, färre än ${kTroskel()} personer: ${utelamnade.join(', ')}.` : ''; }
        }
        // Samma BAS-intervall i kronor: kvinnors och mäns median som två punkter med ett streck emellan.
        const hantelEl = document.getElementById('chart-skevhet-hantel');
        if (hantelEl) { if (bars.length) ritaFigur(hantelEl, _skevhetHantelFigur(bars)); else rensaFigur(hantelEl); }
    }

    const pgBody = /** @type {HTMLElement} */ (document.querySelector("#paygap-table tbody"));
    pgBody.innerHTML = "";
    const pgUtelamnade = [];
    const pgSamlad = [];
    bas.forEach(b => {
        const df = d.filter(r => r.bas === b);
        const kv = df.filter(r => r.kon.includes("kvinna"));
        const ma = df.filter(r => r.kon === "man" || r.kon === "män");
        if (kv.length < 2 || ma.length < 2) return;
        // (a) N-kolumn: antal per kön bakom mediansiffrorna
        const nCell = `<td class="t-hoger">${kv.length}/${ma.length}</td>`;
        const masked = isKMasked(kv.length) || isKMasked(ma.length);
        // Bevis-knapp per BAS-rad
        const evidenceCell = `<td class="t-mitt"><button class="btn-evidence" data-paygap-row="1" type="button" title="Visa beräkningen bakom denna BAS-rad" aria-label="Visa bevis för BAS ${esc(b)}">${ikon('sok')}</button></td>`;
        // k-anonymitet, samma tvådelade regel som i EU-matrisen:
        //  * hela BAS-intervallet för litet -> raden utelämnas (den hade bara
        //    innehållit "< 10" och gett ingenting att analysera)
        //  * bara könsuppdelningen för liten -> BAS:ets SAMLADE median visas,
        //    eftersom den bygger på n >= kTroskel() och inte röjer någon enskild
        if (masked && isKMasked(df.length)) { pgUtelamnade.push(b); return; }
        if (masked) {
            pgSamlad.push(b);
            const trS = document.createElement("tr");
            trS.innerHTML = `<td>${esc(b)}</td>${nCell}<td class="f-dampad">–</td>`
                + `<td class="t-mitt" colspan="2">Gruppens median ${fmt.format(Stat.median(df.map(r => r.lon)))}</td>`
                + `<td class="t-mitt">–</td>`;
            pgBody.appendChild(trS);
            return;
        }
        const gap = (Stat.median(kv.map(r=>r.lon)) / Stat.median(ma.map(r=>r.lon)) * 100).toFixed(1);
        const isCrit = Math.abs(100 - parseFloat(gap)) > 5;
        const tr = document.createElement("tr");
        tr._markering = markeringFor(b);   // länkade vyer; en egenskap, inte ett attribut: utskriften kopierar radernas HTML
        tr.innerHTML = `<td>${esc(b)}</td>${nCell}<td${isCrit ? ' class="f-kritisk fet"' : ''}>${svPct(parseFloat(gap), 1)}</td><td>${fmt.format(Stat.median(kv.map(r=>r.lon)))}</td><td>${fmt.format(Stat.median(ma.map(r=>r.lon)))}</td>${evidenceCell}`;
        tr._paygapRow = { bas: b, kvLons: kv.map(r => r.lon), maLons: ma.map(r => r.lon), masked: false };
        pgBody.appendChild(tr);
    });
    if (pgUtelamnade.length || pgSamlad.length) {
        const trN = document.createElement("tr");
        trN.innerHTML = `<td colspan="6">${kMaskNote(pgUtelamnade, 'BAS-intervall|BAS-intervall')}`
            + `${kSamladNote(pgSamlad, 'BAS-intervall|BAS-intervall')}</td>`;
        pgBody.appendChild(trN);
    }

    // Bevis-popup för paygap-rader
    pgBody.querySelectorAll('.btn-evidence[data-paygap-row]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const tr = btn.closest('tr');
            const payload = tr?._paygapRow;
            if (!payload) return;
            _openEvidenceModal(_evidenceForPaygapRow(payload));
        });
    });
    const skBody = /** @type {HTMLElement} */ (document.querySelector("#skevhet-table tbody"));
    skBody.innerHTML = "";
    let skBasMaskCount = 0;
    const skRader = [];   // samma BAS-intervall och andelar som tabellens rader — underlaget till diagrammet ovanför
    bas.forEach(b => {
        const df = d.filter(r => r.bas === b);
        const nKv = df.filter(r => r.kon.includes("kvinna")).length;
        const nMa = df.filter(r => r.kon === "man" || r.kon === "män").length;
        const tot = nKv + nMa;
        if (tot < 5) { skBasMaskCount++; return; }
        const pctKv = (nKv/tot*100).toFixed(1), pctMa = (nMa/tot*100).toFixed(1);
        skRader.push({ bas: b, tot, pctKv: parseFloat(pctKv), pctMa: parseFloat(pctMa) });
        // Jämn könsfördelning = båda könen >= 40%. Underrepresenterat kön = det
        // kön som ligger under 40-procentströskeln (om något).
        const underrep = parseFloat(pctKv)<40?"Kvinna":parseFloat(pctMa)<40?"Man":"-";
        const tr = document.createElement("tr");
        tr._markering = markeringFor(b);   // länkade vyer; en egenskap, inte ett attribut: utskriften kopierar radernas HTML
        tr.innerHTML = `<td>${esc(b)}</td><td>${tot}</td><td>${svPct(parseFloat(pctKv), 1)}</td><td>${svPct(parseFloat(pctMa), 1)}</td><td${underrep !== '-' ? ' class="f-kritisk"' : ''}>${underrep}</td>`;
        skBody.appendChild(tr);
    });
    const skEl = document.getElementById('chart-skevhet-andel');
    if (skEl) { if (skRader.length) ritaFigur(skEl, _skevhetAndelFigur(skRader)); else rensaFigur(skEl); }

    // Audit
    const baseS = buildBaseAudit();
    let pgKMasked = 0;
    bas.forEach(b => {
        const df = d.filter(r => r.bas === b);
        const kv = df.filter(r => r.kon.includes("kvinna"));
        const ma = df.filter(r => r.kon === "man" || r.kon === "män");
        if (kv.length < 2 || ma.length < 2) return;
        if (isKMasked(kv.length) || isKMasked(ma.length)) pgKMasked++;
    });
    setAudit('skevhet', {
        title: 'Lönegap & Könsfördelning',
        ...baseS,
        usedInAnalysis: baseS.afterFilter,
        analysisExclusions: [
            ...(pgKMasked > 0 ? [[`BAS-intervall maskerade (k-anonymitet n&lt;${kTroskel()} per kön)`, pgKMasked]] : []),
            ...(skBasMaskCount > 0 ? [[`BAS-intervall för små för könsskevhetsanalys (n&lt;5 totalt)`, skBasMaskCount]] : [])
        ],
        formler: [
            ['Lönegap (Kv mot Mä)', '<code>median(kvinnors lön) / median(mäns lön) × 100%</code>. 100% = lika lön.'],
            ['Lagstadgat tröskelvärde', '|gap − 100%| &gt; 5% (EU-direktiv 2023/970, utredningsgräns)'],
            ['Könsskevhet', 'Andel av ett kön &lt; 40% av gruppen (jämn fördelning kräver att båda könen ≥ 40%)'],
            ['Översiktsdiagram', 'Stapel per BAS, färg = avvikelse från 100% (grön ≤3%, gul 3-5%, röd &gt;5%)']
        ],
        notes: [
            `Kräver minst ${kTroskel()} personer av <em>varje kön</em> för att medianer ska visas (k-anonymitet)`,
            'Könsfördelning räknas så länge totalen ≥ 5 (även om ena könet har &lt; 5 individer)'
        ]
    });
}
// EU-matris, prioritering & motiveringsmotor
// ============================================================
// "Lika arbete"-matrisen enligt EU 2023/970, prioriteringsanalysen (vilka
// grupper är mest angelägna, och vad kostar de) samt den AI-fria regelmotorn
// som föreslår testbara hypoteser per prio-rad.
//
// Regressionen och livscykelanalysen ligger i 51-lika-arbete-regressionskort.js.

// ---- EU Directive Matrix ----
// Underrader per ansvarsgrupp (ledningsansvar, särskilt uppdrag, inget) under ett yrke i Lika arbete.
// Samma k-regler som yrkesraden: grupp under k → inga lönemått; ett kön under k → samlad median.
// Visas bara när yrket har minst två ansvarsgrupper. Raden "Utan ledningsansvar" visar kvoten för
// de övriga när yrket har ledningsansvar och båda könen där är minst k.
/**
 * Stabilitetens märkning på en kort rad under statusmärket («Stabil även utan 2 personer»). `hel` är hela meningen
 * (stabilitetKort i src/lib/rapportunderlag.js): de ord som inte behövs på skärmen står kvar som .bara-export, så att
 * cellens text — den exporterna läser — är hela meningen.
 */
function _laStabilitetRad(hel) {
    const dold = t => (t ? `<span class="bara-export">${esc(t)}</span>` : '');
    let m;
    if ((m = /^(Skör: )(kan bli )(.*? tas bort)(.*)$/.exec(hel))) return esc(m[1]) + dold(m[2]) + esc(m[3]) + dold(m[4]);
    if ((m = /^(Stabil)(: över 5 %)( även utan \d person(?:er)?)(.*)$/.exec(hel))) return esc(m[1]) + dold(m[2]) + esc(m[3]) + dold(m[4]);
    if ((m = /^(Kan inte prövas)(.*)$/.exec(hel))) return esc(m[1]) + dold(m[2]);
    return esc(hel);
}
function _ansvarsUnderraderFor(yrkesRader, fmt) {
    if (!yrkesRader.some(x => x.ansvarsgrupp)) return [];
    const under = _anUnderrader(yrkesRader, { k: kTroskel() });
    if (under.length < 2) return [];
    const pct = v => `${v.toFixed(1).replace('.', ',')} %`;
    const ut = under.map(u => {
        const tr = document.createElement('tr');
        tr.className = 'la-underrad';
        let celler;
        if (u.liten) celler = `<td class="t-mitt f-dampad" colspan="3">Färre än ${kTroskel()} personer — inga lönemått</td>`;
        else if (u.samladMedian) celler = `<td class="t-mitt" colspan="2">Gruppens median ${fmt.format(u.medTot)}</td><td>–</td>`;
        else celler = `<td>${fmt.format(u.medKv)}</td><td>${fmt.format(u.medMa)}</td><td>${svPct(u.kvot, 1)}</td>`;
        tr.innerHTML = `<td class="la-underrad-namn">${esc(u.namn)}</td><td>${u.n} (${u.nKv}/${u.nMa})</td><td></td><td></td>${celler}<td></td><td></td>`;
        tr.classList.add('la-underrad-ansvar');   // hopfälld tills yrkesradens pil fäller ut den; raden är ritad ändå (exporterna läser tabellen)
        tr.hidden = true;
        return tr;
    });
    if (under.some(u => u.grupp === 'ledning')) {
        const ovriga = yrkesRader.filter(x => x.ansvarsgrupp && x.ansvarsgrupp !== 'ledning' && x.lon > 0);
        const kv = ovriga.filter(x => _utKonOf(x) === 'Kvinna').map(x => x.lon);
        const ma = ovriga.filter(x => _utKonOf(x) === 'Man').map(x => x.lon);
        if (kv.length >= kTroskel() && ma.length >= kTroskel()) {
            const tr = document.createElement('tr');
            tr.className = 'la-underrad';
            tr.innerHTML = `<td colspan="9" class="la-underrad-namn">Utan ledningsansvar: kvinnors lön i % av mäns ${pct(Stat.median(kv) / Stat.median(ma) * 100)}</td>`;
            ut.push(tr);
        }
    }
    return ut;
}

// SKR:s kvinnoandel för yrkets AID-etikett (efter organisationstypen) — referens bredvid den egna fördelningen.
function _skrReferensCell(yrke) {
    const ref = _skrKvinnoandel(yrke, { del: _skrDel() });
    return ref
        ? `<td data-sort-value="${ref.pct.toFixed(1)}" title="Andel kvinnor nationellt: ${ref.niva === 'etikett' ? 'AID-etiketten' : 'AID-prefixet ' + esc(ref.prefix)} i ${_skrDelText(ref.del)}, ${esc(skrKallaKort())}">${svPct(ref.pct, 0)}</td>`
        : `<td data-sort-value="" title="Yrkeskoden finns inte i ${esc(skrKallaKort())}">–</td>`;
}

function generateEUDirectiveMatrix() {
    renderRegressionCard();
    renderBlinderOaxacaCard();
    const tbody = document.querySelector("#matrix-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const d = getData();
    if (!d.length) return;
    const fmt = new Intl.NumberFormat('sv-SE', {style:'currency',currency:'SEK',maximumFractionDigits:0});
    // Grupperingen och k-reglerna bor i src/lib/rapportunderlag.js (ADR-20), så att
    // tabellen och rapportunderlaget alltid flaggar samma yrken.
    const lika = _ruLikaArbeteGrupper(d, { k: kTroskel(), troskel: 5 });
    _laRitaTratt(d);
    const rows = [];
    const utelamnadeYrken = lika.utelamnade;
    const samladMedianYrken = [];
    lika.grupper.forEach(g => {
        const { yrke, nKv, nMa, tot } = g;
        const pctKv = nKv / tot;
        // Jämn könsfördelning = båda könen >= 40% (= ena könet inom [40%, 60%]).
        // Strikt olikhet på 0.6 — exakt 60/40 räknas som jämnt.
        let dominans = "Könsblandad";
        if (pctKv > 0.6) dominans = "Kvinno-dom";
        else if (pctKv < 0.4) dominans = "Mans-dom";
        // k-anonymitet: yrken där ett kön är under k redovisas med gruppens SAMLADE
        // median (den bygger på n >= kTroskel() och röjer ingen enskild); yrken som
        // helt ligger under k utelämnas och räknas upp i noten under tabellen.
        if (g.samladMedian) {
            samladMedianYrken.push(yrke);
            rows.push({ yrke, nKv, nMa, tot, dominans,
                medTot: g.medTot, gap: 0, samladMedian: true,
                statusKlass: '', status: `<span class="f-dampad la-status la-status-liten" title="Könsuppdelningen är för liten: ett kön har färre än ${kTroskel()} personer"><span class="bara-export">Könsuppdelningen är för liten (</span>ett kön n &lt; ${kTroskel()}<span class="bara-export">)</span></span>` });
            return;
        }
        const { medKv, medMa, kvot: ratio, gapPct: gap } = g;
        let status, statusKlass = "";
        // Märket står på en rad med tröskeln i verktygstipset. Det som bara exporterna ska bära (tröskeln, hela meningen
        // om stabiliteten) står kvar i cellen som .bara-export: dolt på skärmen, med i cellens text.
        const bara = t => `<span class="bara-export">${t}</span>`;
        status = `<span class="la-status farg-ok" title="Skillnaden är högst 3 %">${bara('✓')}${ikon('bock')} Balanserat${bara(' (≥ 3%)')}</span>`;
        if (g.flaggad) {
            const stabil = _ruStabilitetKort(g.stabilitet, kTroskel());
            status = `<span class="la-status farg-granska" title="Skillnaden är över 5 % (EU-direktivets utredningströskel)">${ikon('nal')} Värt att granska${bara(' (&gt; 5%)')}</span>`
                + ` <br><span class="la-stabilitet" title="${esc(stabil)}">${_laStabilitetRad(stabil)}</span>`;
            statusKlass = "rad-granska";
        }
        else if (gap > 3) { status = `<span class="la-status farg-varning" title="Skillnaden är mellan 3 och 5 %">${ikon('oga')} Följ upp${bara(' (3-5%)')}</span>`; statusKlass = "rad-folj"; }
        // Kvinnors median i procent av mäns — som kolumnens exportrubrik säger.
        const displayGap = svPct(ratio * 100, 1);
        rows.push({yrke, nKv, nMa, tot, dominans, medKv, medMa, gap, displayGap, status, statusKlass, samladMedian: false,
            niva: g.flaggad ? 'granska' : gap > 3 ? 'folj' : 'balanserat', kvot: ratio * 100 });
    });
    rows.sort((a,b) => b.gap - a.gap);
    // Kvoten ritas i raden mot 100 %, på samma sätt som i översiktstabellen överst (ett omfång för hela tabellen).
    const kvotDoman = _laOversiktDoman(rows.filter(r => !r.samladMedian && isFinite(r.kvot)).map(r => ({ gap: r.kvot })));
    rows.forEach(r => {
        const tr = document.createElement("tr");
        if (r.statusKlass) tr.className = r.statusKlass;   // en klass, inte tr.style: raden klonas ut i PDF-rapporten som markering, där CSP:n stoppar style-attribut
        const cellKv = r.samladMedian
            ? `<td colspan="2" class="t-mitt" data-sort-value="${r.medTot}">Gruppens median ${fmt.format(r.medTot)}</td>`
            : `<td data-sort-value="${r.medKv}">${fmt.format(r.medKv)}</td>`;
        const cellMa = r.samladMedian ? '' : `<td data-sort-value="${r.medMa}">${fmt.format(r.medMa)}</td>`;
        const gapSort = r.gap;
        // #2 Power-varning per yrkesgrupp
        const groupGap = Math.abs(r.gap - 100);
        const grpMDE = computeGroupMDE(r.nKv, r.nMa);
        const lowPower = grpMDE && (grpMDE.tooSmall || grpMDE.mdePct > groupGap);
        const powerBadge = lowPower && !r.samladMedian
            ? ` <span title="Låg statistisk styrka — gruppens minsta detekterbara effekt ≈ ${svPct(grpMDE.mdePct, 1)}, ${grpMDE.tooSmall ? 'och underlaget per kön är litet (<5)' : 'större än observerad avvikelse'}. Tolka resultatet med försiktighet." class="farg-varning hjalpmarke hjalp-markor">${ikon('statusVarning', 14)}</span>`
            : '';
        tr.innerHTML = `<td>${esc(r.yrke)}${powerBadge}</td><td data-sort-value="${r.tot}">${r.tot} (${r.nKv}/${r.nMa})</td><td>${r.dominans}</td>${_skrReferensCell(r.yrke)}${cellKv}${cellMa}<td data-sort-value="${gapSort}">${r.samladMedian ? '–' : `<span class="la-kvotcell"${_kvotcellTitel(r)}>${_laOversiktGrafik({ gap: r.kvot, ci: null }, kvotDoman, _SKEVHET_STATUS.find(s => s.galler(Math.abs(100 - r.kvot))), 64)}<span>${r.displayGap}</span></span>`}</td><td>${r.status}</td><td class="ta-mitt ingen-radbrytning"><button class="row-cross-link" data-target="rapport" data-yrke="${esc(r.yrke)}" title="Öppna i Löneöversikten" aria-label="Öppna ${esc(r.yrke)} i Löneöversikten">${ikon('pilUt', 14)}</button>${r.samladMedian ? '' : ` <button class="btn-evidence" data-eu-row="1" type="button" title="Visa beräkningen bakom denna rad" aria-label="Visa bevis för ${esc(r.yrke)}">${ikon('sok')}</button>`}</td>`;
        // Cache rad-data så bevis-handler kan plocka upp objektet
        tr._euRow = r;
        tbody.appendChild(tr);
        const under = _ansvarsUnderraderFor(d.filter(x => x.yrke === r.yrke), fmt);
        under.forEach(u => tbody.appendChild(u));
        if (under.some(u => u.classList.contains('la-underrad-ansvar'))) {
            // Pilen på yrkesraden fäller ut ansvarsgrupperna; raden «Utan ledningsansvar» bär ett tal och står alltid kvar.
            const pil = document.createElement('button');
            pil.type = 'button';
            pil.className = 'la-falla';
            pil.setAttribute('aria-expanded', 'false');
            pil.setAttribute('aria-label', `Visa ansvarsgrupperna för ${r.yrke}`);
            pil.title = 'Visa ansvarsgrupperna';
            pil.addEventListener('click', e => {
                e.stopPropagation();
                const oppna = pil.getAttribute('aria-expanded') !== 'true';
                pil.setAttribute('aria-expanded', String(oppna));
                under.forEach(u => { if (u.classList.contains('la-underrad-ansvar')) u.hidden = !oppna; });
            });
            /** @type {HTMLElement} */ (tr.firstElementChild).insertBefore(pil, /** @type {HTMLElement} */ (tr.firstElementChild).firstChild);
        }
    });
    if (utelamnadeYrken.length || samladMedianYrken.length) {
        const trN = document.createElement("tr");
        trN.innerHTML = `<td colspan="9">${kMaskNote(utelamnadeYrken, 'yrkesgrupp|yrkesgrupper')}`
            + `${kSamladNote(samladMedianYrken, 'yrkesgrupp|yrkesgrupper')}</td>`;
        tbody.appendChild(trN);
    }
    if (lika.grupper.some(g => g.flaggad)) {
        const trS = document.createElement("tr");
        trS.innerHTML = `<td colspan="9" class="text-dampad-xs">Skör betyder att skillnaden kan hamna på 5 % eller under om en eller två personer tas bort ur gruppen. Flaggan ligger kvar — märkningen visar var enskilda löner avgör utfallet.</td>`;
        tbody.appendChild(trS);
    }

    // Bevis-popup för EU-matris-rader
    tbody.querySelectorAll('.btn-evidence[data-eu-row]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const tr = btn.closest('tr');
            const row = tr?._euRow;
            if (!row) return;
            _openEvidenceModal(_evidenceForEUMatrixRow(row));
        });
    });

    // Audit
    const baseM = buildBaseAudit();
    const skippedTooFewKvOrMa = lika.ejJamforbara.length;
    const maskedYrken = utelamnadeYrken.length;
    const reg = runOLSRegression();
    const regNote = reg.error ? `Regression: <em>${esc(reg.error)}</em>` : `Regression estimerad: <code>log(lön) ~ ${esc(reg.modelDesc)}</code> · n=${reg.n}, R²=${svPct((reg.R2*100), 1)}`;
    setAudit('matrix', {
        title: 'Lika arbete — multivariat regression',
        ...baseM,
        usedInAnalysis: rows.length,
        analysisExclusions: [
            ...(skippedTooFewKvOrMa > 0 ? [['Yrkesgrupper med &lt;2 av varje kön (ej jämförbara)', skippedTooFewKvOrMa]] : []),
            ...(maskedYrken > 0 ? [[`Yrkesgrupper utelämnade, k-anonymitet (kön n&lt;${kTroskel()})`, maskedYrken]] : [])
        ],
        formler: [
            ['Lönegap per yrke', '<code>(median Kv / median Mä − 1) × 100%</code>'],
            ['Status-tröskel', '≥ 3 % Balanserat · 3–5 % Följ upp · &gt; 5 % Värt att granska (EU 2023/970)'],
            ['Dominans', 'Kvinnodominerad om >60% kvinnor, mansdominerad om >60% män (dvs. ett kön < 40%), annars könsblandad (jämn fördelning = båda könen ≥ 40%)'],
            ['OLS-regression', 'log(lön) ~ kön + ålder + BAS-intervall (indikatorvariabler, första BAS som referens). Standardfel: HC3 robust (Long &amp; Ervin 2000)'],
            ['BAS-rangordning', 'Fast enligt BAS-systemet: A lägst (t.ex. 0–99 poäng), B nästa intervall (100–199) osv.; rang = bokstavens plats (A=1, B=2 …); ett BAS-steg är alltid ett intervall, även när en bokstav saknas i underlaget; högre rang = högre värderat arbete'],
            ['Per-BAS regression', `Separat <code>log(lön) ~ kön + ålder</code> inom varje BAS med ≥${statGolv()} av varje kön`]
        ],
        notes: [
            regNote,
            'Bedömning av "saklig/osaklig" skillnad kräver kompletterande granskning – verktyget identifierar endast statistiska avvikelser'
        ]
    });
}

document.getElementById("search-skevhet")?.addEventListener("input", e => {
    const q = /** @type {HTMLInputElement} */ (e.target).value.toLowerCase();
    document.querySelectorAll("#skevhet-table tbody tr").forEach(tr => { /** @type {HTMLElement} */ (tr).style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none"; });
});


// Översiktsdiagrammets figur (diagramkärnan, ADR-39): kvinnors median i % av männens per BAS-intervall, med 95 % KI.
// Formen är en punkt med intervall mot en referenslinje (100 % = lika lön) — inte en stapel: en stapel från en
// avkortad axel säger ingenting med sin längd, och det som ska läsas är avståndet till 100 och om intervallet når dit.
// Statusen är en SERIE med egen symbol — färgen bär den inte ensam,
// och förklaringen namnger den. `bars` är bara de BAS där båda könen når tröskeln; inga andra når figuren.
const _SKEVHET_STATUS = [
    { serie: 'Avviker mer än 5 %', farg: 'kritisk', symbol: 'romb', galler: a => a > 5 },
    { serie: 'Avviker 3–5 %', farg: 'varning', symbol: 'kvadrat', galler: a => a > 3 },
    { serie: 'Inom 3 %', farg: 'ok', symbol: 'cirkel', galler: () => true }
];
function _skevhetFigur(bars) {
    const status = o => _SKEVHET_STATUS.find(s => s.galler(Math.abs(100 - o.gap)));
    const pkt = o => ({ y: 'BAS ' + o.bas, x: +o.gap.toFixed(1), etikett: _figTalformat(o.gap, 'pct'), n: o.n, markering: markeringFor(o.bas),
                        ...(o.ci ? { fel: { lag: o.ci.lo, hog: o.ci.hi } } : {}), ..._kronorFalt(o.medKv, o.medMa) });
    const tips = d => [[d.y], ['Kvinnors median', `${_figTalformat(d.x, 'pct')} av männens`], ..._figKronorTipsRad(d.skillnadKr),
        ['95 % KI', d.fel ? `${_figTalformat(d.fel.lag, 'pct', { enhet: false })}–${_figTalformat(d.fel.hog, 'pct')}` : '–'], ['Antal', String(d.n)]];
    return { beskrivning: 'Kvinnors medianlön i procent av männens per BAS-intervall, som en punkt med 95 % konfidensintervall mot linjen för lika lön (100 %). Detaljerade siffror finns i tabellerna nedan.',
        y: { skala: 'band', ordning: bars.map(o => 'BAS ' + o.bas) },
        x: { skala: 'linjar', titel: 'Kvinnors median i % av männens — 100 = lika lön',
             doman: [Math.floor(Math.min(90, ...bars.map(o => (o.ci ? o.ci.lo : o.gap))) - 2), Math.ceil(Math.max(110, ...bars.map(o => (o.ci ? o.ci.hi : o.gap))) + 2)] },
        hojd: Math.max(180, 110 + bars.length * 34),
        referens: [{ typ: 'zon', x0: 95, x1: 105, farg: PALETTE.semantic.ok, opacitet: 0.08, etikett: 'Lika lön ±5 %' },
                   { x: 100, farg: PALETTE.semantic.mork, tjocklek: 1.5 }],
        lager: _SKEVHET_STATUS.map(s => ({ marke: 'punkt', riktning: 'liggande', symbol: s.symbol, storlek: 6, serie: s.serie, farg: PALETTE.semantic[s.farg],
            data: bars.filter(o => status(o) === s).map(pkt), tips }))
            .filter(l => l.data.length) };
}

// Flikens huvudvy: en rad per BAS-intervall med ALLA värden — antal per kön, de två medianerna, skillnaden i kronor
// och kvoten — och kvoten ritad i raden mot 100 %. Med få kategorier, flera mått och blandade enheter (kronor,
// procent, antal) är en tabell med inbyggd grafik rätt form; ett diagram visar bara ett av måtten. `bars` är samma
// rader som diagrammen får: bara BAS där båda könen når tröskeln, så varje tal i raden bygger på minst k personer.
// Grafiken i cellen är en utsmyckning av talet i cellen bredvid (aria-hidden), inget eget diagram: den har ingen
// export, ingen förklaring och inga värden som inte står i raden.
const _LA_OV = { b: 168, h: 24 };
function _laOversiktDoman(bars) {
    return [Math.floor(Math.min(88, ...bars.map(o => (o.ci ? o.ci.lo : o.gap))) - 1), Math.ceil(Math.max(106, ...bars.map(o => (o.ci ? o.ci.hi : o.gap))) + 1)];
}
// Kvotcellens verktygstips i yrkesgruppstabellen: skillnaden i kronor per månad. Raden har
// bara medianer per kön när båda könen når tröskeln (annars samlad median och ingen kvot).
function _kvotcellTitel(r) {
    const rad = _figKronorTipsRad(_figKronorSkillnad(r.medKv, r.medMa))[0];
    return rad ? ` title="${esc(`${rad[0]}: ${rad[1]}`)}"` : '';
}
function _laOversiktGrafik(o, dom, status, bredd) {
    const b = bredd || _LA_OV.b, h = _LA_OV.h, x = v => +((v - dom[0]) / (dom[1] - dom[0]) * b).toFixed(1), m = h / 2, farg = PALETTE.semantic[status.farg], px = x(o.gap);
    const symbol = status.symbol === 'romb' ? `<path d="M${px},${m - 6}L${px + 6},${m}L${px},${m + 6}L${px - 6},${m}Z" fill="${farg}" stroke="#fff"/>`
        : status.symbol === 'kvadrat' ? `<rect x="${px - 4.5}" y="${m - 4.5}" width="9" height="9" rx="1" fill="${farg}" stroke="#fff"/>`
        : `<circle cx="${px}" cy="${m}" r="5" fill="${farg}" stroke="#fff"/>`;
    return `<svg class="la-oversikt-grafik" viewBox="0 0 ${b} ${h}" width="${b}" height="${h}" aria-hidden="true" focusable="false">`
        + `<rect x="${x(95)}" y="2" width="${+(x(105) - x(95)).toFixed(1)}" height="${h - 4}" fill="${PALETTE.semantic.ok}" fill-opacity="0.12"/>`
        + `<line x1="${x(100)}" x2="${x(100)}" y1="0" y2="${h}" stroke="${PALETTE.semantic.mork}" stroke-width="1.2"/>`
        + (o.ci ? `<line x1="${x(o.ci.lo)}" x2="${x(o.ci.hi)}" y1="${m}" y2="${m}" stroke="${farg}" stroke-width="2" stroke-linecap="round" stroke-opacity="0.7"/>` : '')
        + symbol + '</svg>';
}
function _laOversiktTabell(bars) {
    const tb = document.querySelector('#la-oversikt tbody'), skala = document.getElementById('la-oversikt-skala');
    if (!tb) return;
    tb.innerHTML = '';
    if (skala) skala.innerHTML = '';
    if (!bars.length) {
        tb.innerHTML = '<tr><td colspan="8" class="la-oversikt-tom">För få BAS-intervall där både kvinnor och män når minsta gruppstorlek.</td></tr>';
        return;
    }
    const dom = _laOversiktDoman(bars), { b } = _LA_OV;
    // Skalan står i kolumnens rubrik: samma omfång som varje rads grafik, med 95, 100 och 105 utsatta.
    if (skala) {
        const x = v => +((v - dom[0]) / (dom[1] - dom[0]) * b).toFixed(1);
        skala.innerHTML = `<svg viewBox="0 0 ${b} 16" width="${b}" height="16" aria-hidden="true" focusable="false">`
            + [95, 100, 105].map(v => `<text x="${x(v)}" y="12" text-anchor="middle" font-size="11" fill="currentColor">${v}${v === 100 ? ' %' : ''}</text>`).join('') + '</svg>';
    }
    for (const o of bars) {
        const status = _laOversiktStatus(o);
        const skillnad = Math.round(o.medKv) - Math.round(o.medMa);
        const tr = document.createElement('tr');
        tr._markering = markeringFor(o.bas);
        tr.innerHTML = `<th scope="row">BAS ${esc(o.bas)}</th><td class="tal">${o.nKv} / ${o.nMa}</td><td class="tal">${_figTalformat(Math.round(o.medKv), 'kr')}</td><td class="tal">${_figTalformat(Math.round(o.medMa), 'kr')}</td>`
            + `<td class="tal">${skillnad < 0 ? '−' : skillnad > 0 ? '+' : ''}${_figTalformat(Math.abs(skillnad), 'kr')}</td>`
            + `<td class="la-oversikt-cell">${_laOversiktGrafik(o, dom, status)}</td>`
            + `<td class="tal la-oversikt-kvot">${svPct(o.gap, 1)}${o.ci ? `<span class="la-oversikt-ki">${svTal(o.ci.lo, 1)}–${svPct(o.ci.hi, 1)}</span>` : ''}</td>`
            + `<td><span class="la-status ar-${status.farg}">${esc(status.serie)}</span></td>`;
        tb.appendChild(tr);
    }
}

// ---- Trattdiagram: yrkesgrupperna mot slumpens gränser ----
// Standardmetoden för att jämföra enheter av olika storlek (Spiegelhalter): värdet mot storleken, med gränser som
// smalnar när enheten växer. Här: kvinnors median i % av mäns per yrkesgrupp mot antalet personer.
//
// BEDÖMNINGEN av en grupp görs med omkastning (permutation) inom gruppen: könen kastas om slumpvis mellan gruppens
// löner 1 000 gånger, och gruppens kvot jämförs med de mittersta 95 % av de kvoter slumpen ger. Det är exakt för
// gruppens egen lönefördelning och egna antal — också för små grupper, ojämn könsfördelning och löner i steg.
// Slumptalen är seedade ur datat (_rngFor), så resultatet är detsamma varje gång.
//
// Det skuggade FÄLTET är en jämn kurva för orientering, ritad för en grupp med lika många kvinnor som män:
// 1,96 × 1,2533 × σ × √(1/nKv + 1/nMa), där σ = 1,4826 × MAD av ln(lön) − ln(könets median i gruppen) över alla
// grupper i diagrammet (per kön, så att en verklig könsskillnad inte blåser upp spridningen). Formeln är en
// normalapproximation som i simulering var 4–7 % för snäv vid 10–15 per kön och rätt från cirka 40; faktorn
// (1 + 0,6/n per kön) rättar det. En punkt kan därför ligga strax
// innanför fältet och ändå bedömas som utanför, eller tvärtom: punktens färg och form följer omkastningen.
// Bara yrkesgrupper där båda könen når tröskeln finns med.
const LA_TRATT_OMKAST = 1000, LA_TRATT_STOR = 300;
// Med färre grupper än så säger trattens form lite: förbehållet under diagrammet.
const LA_TRATT_GLEST = 10;
const LA_TRATT_GLEST_NOT = 'Med färre än tio grupper säger trattens form lite; bedöm varje grupp för sig i tabellen.';
/** Trattens metodförbehåll för så många grupper, eller null. Används under diagrammet och i rapporten. */
function _laTrattGlesNot(antal) { return antal > 0 && antal < LA_TRATT_GLEST ? LA_TRATT_GLEST_NOT : null; }
function _laTrattOmkastning(kv, ma, B = LA_TRATT_OMKAST) {
    const alla = kv.concat(ma), n = alla.length, nKv = kv.length, rnd = _rngFor(kv, ma), kvoter = new Array(B);
    for (let b = 0; b < B; b++) {
        // Ofullständig Fisher–Yates: de första nKv platserna blir ett slumpvis urval utan återläggning.
        for (let i = 0; i < nKv; i++) { const j = i + ((rnd() * (n - i)) | 0), t = alla[i]; alla[i] = alla[j]; alla[j] = t; }
        const mKv = _quickMedian(alla.slice(0, nKv)), mMa = _quickMedian(alla.slice(nKv));
        kvoter[b] = mMa > 0 ? mKv / mMa * 100 : 100;
    }
    kvoter.sort((x, y) => x - y);
    return { lag: kvoter[Math.floor(B * 0.025)], hog: kvoter[Math.min(B - 1, Math.floor(B * 0.975))] };
}
function _laTrattUnderlag(d, k = kTroskel()) {
    const minne = _laMinneFor(d, k);
    if (!('tratt' in minne)) minne.tratt = _laTrattUnderlagRakna(d, k);
    return minne.tratt;
}
function _laTrattUnderlagRakna(d, k) {
    const perYrke = new Map();
    for (const r of d) {
        if (!(r.lon > 0)) continue;
        const kv = r.kon.includes('kvinna'), ma = r.kon === 'man' || r.kon === 'män';
        if (!kv && !ma) continue;
        if (!perYrke.has(r.yrke)) perYrke.set(r.yrke, { yrke: r.yrke, bas: r.bas, aid: r.aid, kv: [], ma: [] });
        perYrke.get(r.yrke)[kv ? 'kv' : 'ma'].push(r.lon);
    }
    const grupper = [...perYrke.values()].filter(g => g.kv.length >= k && g.ma.length >= k);
    if (!grupper.length) return null;
    const rest = [];
    for (const g of grupper) {
        g.medKv = Stat.median(g.kv); g.medMa = Stat.median(g.ma);
        for (const v of g.kv) rest.push(Math.log(v) - Math.log(g.medKv));
        for (const v of g.ma) rest.push(Math.log(v) - Math.log(g.medMa));
    }
    const sigma = 1.4826 * Stat.median(rest.map(Math.abs));
    if (!(sigma > 0)) return null;
    const halv = (nKv, nMa) => 100 * 1.96 * 1.2533 * sigma * Math.sqrt(1 / nKv + 1 / nMa) * (1 + 0.6 / Math.min(nKv, nMa));
    // En stor grupp (över LA_TRATT_STOR personer) bedöms med normalformeln och gruppens EGEN spridning: där är formeln
    // rätt (simuleringen: från cirka 40 per kön), och omkastningens kostnad växer med gruppens storlek.
    const egenGrans = g => { const r = [...g.kv.map(v => Math.abs(Math.log(v) - Math.log(g.medKv))), ...g.ma.map(v => Math.abs(Math.log(v) - Math.log(g.medMa)))];
        const h = 100 * 1.96 * 1.2533 * 1.4826 * Stat.median(r) * Math.sqrt(1 / g.kv.length + 1 / g.ma.length); return { lag: 100 - h, hog: 100 + h }; };
    return { sigma, halv, punkter: grupper.map(g => { const kvot = g.medKv / g.medMa * 100, grans = g.kv.length + g.ma.length > LA_TRATT_STOR ? egenGrans(g) : _laTrattOmkastning(g.kv, g.ma);
        return { yrke: g.yrke, bas: g.bas, aid: g.aid, n: g.kv.length + g.ma.length, nKv: g.kv.length, nMa: g.ma.length, medKv: g.medKv, medMa: g.medMa, kvot, gransLag: grans.lag, gransHog: grans.hog,
                 utanfor: kvot < grans.lag || kvot > grans.hog }; }) };
}
function _laTrattFigur(u, k = kTroskel()) {
    // Axeln börjar vid den minsta grupp som kan finnas med (tröskeln för varje kön), så att trattens form syns också
    // när grupperna i urvalet råkar vara ungefär lika stora.
    const nMax = Math.max(...u.punkter.map(p => p.n)), x0 = Math.max(2, 2 * k), x1 = Math.max(nMax * 1.06, x0 + 10), steg = 40;
    const falt = Array.from({ length: steg + 1 }, (_, i) => { const n = x0 + (x1 - x0) * i / steg, h = u.halv(n / 2, n / 2); return { x: +n.toFixed(1), lag: +(100 - h).toFixed(2), hog: +(100 + h).toFixed(2) }; });
    const tips = d => [[d.p.yrke], ['Kvinnors median', `${_figTalformat(d.y, 'pct')} av männens`], ..._figKronorTipsRad(d.skillnadKr), ['Antal kvinnor / män', `${d.p.nKv} / ${d.p.nMa}`],
        ['Slumpens gränser för gruppen', `${_figTalformat(d.p.gransLag, 'pct', { enhet: false })}–${_figTalformat(d.p.gransHog, 'pct')}`], ['Bedömning', d.p.utanfor ? 'utanför slumpens gränser' : 'inom slumpens gränser']];
    // Bara de sex grupper utanför gränserna som avviker mest namnges i bilden: med fler krockar namnen med varandra.
    // Alla grupper har sitt namn i verktygstipset och i tabellen under.
    const namngivna = new Set(u.punkter.filter(p => p.utanfor).sort((a, b) => Math.abs(b.kvot - 100) - Math.abs(a.kvot - 100)).slice(0, 6));
    const lager = (serie, farg, symbol, valj) => ({ marke: 'punkt', serie, farg, symbol, storlek: 6, etikettLage: 'auto',
        data: u.punkter.filter(valj).map(p => ({ x: p.n, y: +p.kvot.toFixed(1), p, markering: markeringFor(p.bas, p.aid), ..._kronorFalt(p.medKv, p.medMa), ...(namngivna.has(p) ? { etikett: _rfKorta(String(p.yrke), 24) } : {}) })), tips });
    const ys = [...falt.flatMap(f => [f.lag, f.hog]), ...u.punkter.map(p => p.kvot)];
    return { beskrivning: 'Trattdiagram: kvinnors medianlön i procent av mäns per yrkesgrupp mot gruppens storlek. Det skuggade fältet är de 95-procentiga gränserna för vad slumpen kan ge vid den gruppstorleken, och smalnar när gruppen blir större. Samma grupper finns i tabellen nedan.',
        x: { skala: 'linjar', titel: 'Antal personer i yrkesgruppen', doman: [x0, x1] },
        y: { skala: 'linjar', titel: 'Kvinnors median i % av mäns', doman: [Math.floor(Math.min(...ys) - 1), Math.ceil(Math.max(...ys) + 1)] },
        hojd: 340,
        referens: [{ y: 100, farg: PALETTE.semantic.mork, tjocklek: 1.5, etikett: 'Lika lön' }],
        lager: [{ marke: 'band', serie: 'Slumpens gränser (95 %)', farg: PALETTE.semantic.neutral, opacitet: 0.14, data: falt },
                lager('Inom gränserna', PALETTE.semantic.neutral, 'cirkel', p => !p.utanfor), lager('Utanför gränserna', PALETTE.semantic.kritisk, 'romb', p => p.utanfor)].filter(l => l.data.length) };
}
function _laRitaTratt(d) {
    const el = document.getElementById('chart-la-tratt'), kort = document.getElementById('la-tratt-kort'), not = document.getElementById('la-tratt-not');
    if (!el) return;
    const u = d && d.length ? _laTrattUnderlag(d) : null;
    // Med färre än två grupper finns inget att jämföra: kortet visas inte.
    if (kort) kort.hidden = !u || u.punkter.length < 2;
    if (!u || u.punkter.length < 2) { rensaFigur(el); if (not) not.textContent = ''; _setDiagramMetodNot('chart-la-tratt', null); return; }
    ritaFigur(el, _laTrattFigur(u));
    _setDiagramMetodNot('chart-la-tratt', _laTrattGlesNot(u.punkter.length));
    const ute = u.punkter.filter(p => p.utanfor).length;
    if (not) not.textContent = `${u.punkter.length} yrkesgrupper där både kvinnor och män når minsta gruppstorlek; ${ute} ligger utanför gränserna. Punktens färg bygger på en omkastning av könen inom gruppen (1 000 gånger; för grupper över 300 personer en normalapproximation) och gäller gruppens egna löner och antal; det skuggade fältet är en jämn kurva för orientering, ritad för lika många kvinnor som män. Gränserna är ett stöd för bedömningen, inte ett test som friar eller fäller.`;
}

// Hanteln: kvinnors och mäns medianlön per BAS-intervall, sorterat efter skillnaden i kronor — den
// största överst. Diagrammet ovanför visar kvoten; hanteln visar vad den motsvarar i kronor.
// `bars` är bara de BAS där båda könen når tröskeln, som för diagrammet ovanför.
// Könsfördelningen per BAS-intervall som staplade staplar till 100 %, med gränserna för jämn könsfördelning
// (40 och 60 %) som linjer. Samma BAS-intervall och samma andelar som tabellen under diagrammet.
function _skevhetAndelFigur(rader) {
    const serie = (namn, farg, falt) => ({ marke: 'stapel', lage: 'staplad', riktning: 'liggande', serie: namn, farg,
        data: rader.map(o => ({ y: 'BAS ' + o.bas, x: o[falt], n: o.tot, markering: markeringFor(o.bas), ...(o[falt] >= 8 ? { etikett: _figTalformat(o[falt], 'pct') } : {}) })),
        tips: d => [[d.y], [namn, _figTalformat(d.x, 'pct')], ['Antal i intervallet', String(d.n)]] });
    return { beskrivning: 'Andel kvinnor och män per BAS-intervall, staplat till 100 procent. Linjerna vid 40 och 60 procent är gränserna för jämn könsfördelning. Samma siffror finns i tabellen nedan.',
        y: { skala: 'band', ordning: rader.map(o => 'BAS ' + o.bas) },
        x: { skala: 'linjar', titel: 'Andel av intervallet (%)', doman: [0, 100] },
        hojd: Math.max(160, 70 + rader.length * 32),
        // Linjerna har ingen etikett: den skulle skriva över staplarnas siffror, och axeln visar 40 och 60.
        referens: [{ x: 40, streck: 'streckad', farg: PALETTE.semantic.mork, tjocklek: 1.5 }, { x: 60, streck: 'streckad', farg: PALETTE.semantic.mork, tjocklek: 1.5 }],
        lager: [serie('Kvinnor', PALETTE.kon.kvinna, 'pctKv'), serie('Män', PALETTE.kon.man, 'pctMa')] };
}

function _skevhetHantelFigur(bars) {
    const sorterade = bars.slice().sort((a, b) => Math.abs(b.medMa - b.medKv) - Math.abs(a.medMa - a.medKv));
    const y = o => 'BAS ' + o.bas, kr = v => _figTalformat(v, 'kr');
    const punkt = (serie, farg, varde, antal) => ({ marke: 'punkt', serie, farg, storlek: 6,
        data: sorterade.map(o => ({ y: y(o), x: Math.round(varde(o)), n: antal(o), markering: markeringFor(o.bas) })),
        tips: d => [[d.y], [`${serie}, median`, kr(d.x)], ['Antal', String(d.n)]] });
    return { beskrivning: 'Kvinnors och mäns medianlön per BAS-intervall, med ett streck för skillnaden. Samma BAS-intervall som i diagrammet ovanför; siffrorna finns i tabellen nedan.',
        x: { skala: 'linjar', titel: 'Medianlön (kr/månad)', format: 'kr' }, y: { skala: 'band', ordning: sorterade.map(y) },
        hojd: Math.max(160, 96 + 32 * sorterade.length),
        lager: [{ marke: 'intervall', riktning: 'liggande', serie: 'Skillnad kvinnor–män', farg: PALETTE.semantic.neutral, tjocklek: 2, legend: false,
                  data: sorterade.map(o => ({ y: y(o), lag: Math.round(Math.min(o.medKv, o.medMa)), hog: Math.round(Math.max(o.medKv, o.medMa)), skillnad: Math.round(o.medMa - o.medKv), markering: markeringFor(o.bas) })),
                  tips: d => [[d.y], ['Män − kvinnor', `${d.skillnad >= 0 ? '+' : '−'}${kr(Math.abs(d.skillnad))}`]] },
                punkt('Kvinnor', PALETTE.kon.kvinna, o => o.medKv, o => o.nKv), punkt('Män', PALETTE.kon.man, o => o.medMa, o => o.nMa)] };
}

// ====================================================================
// Flikens topp: urval, slutsatser och avsnittens nyckeltal (ADR-41)
//
// Talen hämtas ur det som fliken redan har ritat — tabellraderna och deras data — så att toppen aldrig kan säga
// något annat än tabellerna under, och aldrig något som inte får visas: en rad som inte ritats (liten grupp) finns
// inte att räkna. Regressionens gap står som skillnad, som i kortet.
// ====================================================================
// Texten under talet är kort (högst 40 tecken) och får två rader; en längre förklaring står i rutans verktygstips.
function _laSlutsats(etikett, varde, under, kritisk, tips) {
    return `<div class="slutsats"${tips ? ` title="${esc(tips)}"` : ''}><div class="slutsats-etikett">${esc(etikett)}</div><div class="slutsats-varde">${esc(varde)}</div>`
        + `<div class="slutsats-under${kritisk ? ' ar-kritisk' : ''}">${esc(under)}</div></div>`;
}
function _laNyckel(id, text, kritisk) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('ar-kritisk', !!kritisk);
}
/** Urvalsraden: vad fliken gäller. Det markerade står i raden under den (11-markering.js), i alla flikar. */
function _laRitaUrval() {
    const urval = document.getElementById('la-urval'), d = getData();
    if (!urval) return;
    if (!d.length) { urval.textContent = ''; return; }
    urval.innerHTML = `<span><strong>Hela urvalet</strong> · ${svTal(d.length, 0)} personer</span>${kTroskelLank()}`;
}
function renderLikaArbeteTopp() {
    const urval = document.getElementById('la-urval'), ut = document.getElementById('la-slutsatser');
    if (!urval || !ut) return;
    const d = getData();
    if (!d.length) {
        urval.textContent = ''; ut.innerHTML = '';
        for (const id of ['nyckel-la-yrkesgrupper', 'nyckel-la-personer', 'nyckel-la-bas', 'nyckel-la-kon', 'nyckel-la-regression']) _laNyckel(id, '');
        return;
    }
    _laRitaUrval();
    // Yrkesgrupperna: raderna som tabellen visar med könsuppdelning.
    const rader = [...document.querySelectorAll('#matrix-table tbody tr')].map(tr => tr._euRow).filter(r => r && !r.samladMedian);
    const granska = rader.filter(r => r.niva === 'granska'), folj = rader.filter(r => r.niva === 'folj');
    const storst = rader.slice().sort((a, b) => Math.abs(100 - b.kvot) - Math.abs(100 - a.kvot))[0];
    // Per BAS-intervall: de intervall där båda könen når tröskeln.
    const bas = [...document.querySelectorAll('#paygap-table tbody tr')].map(tr => tr._paygapRow).filter(r => r && !r.masked);
    const basKvot = bas.map(r => ({ bas: r.bas, kvot: Stat.median(r.kvLons) / Stat.median(r.maLons) * 100 })).filter(r => isFinite(r.kvot));
    const basOver = basKvot.filter(r => Math.abs(100 - r.kvot) > 5);
    const konRader = [...document.querySelectorAll('#skevhet-table tbody tr')];
    const ojamna = konRader.filter(tr => /** @type {HTMLTableRowElement} */ (tr).cells[4] && /** @type {HTMLTableRowElement} */ (tr).cells[4].textContent.trim() !== '-').length;
    // Regressionen och personerna.
    /** @type {any} */ let reg = null;
    try { reg = runOLSRegression(); } catch (e) { rapporteraFel('Lika arbete: toppen', e); }
    const regOk = reg && !reg.error && typeof reg.konPct === 'number';
    /** @type {number|null} */ let personer = null;
    try { const r = _ifFlaggaIndivider(d, { minGrupp: statGolv(), grans: _pagGrans() }); personer = r.provade.kv + r.provade.ma ? r.flaggade.length : null; }
    catch (e) { rapporteraFel('Lika arbete: toppen', e); }
    const grans = typeof _pagGrans === 'function' ? svTal(_pagGrans(), 0) : '10';
    ut.innerHTML = [
        rader.length ? _laSlutsats('Yrkesgrupper att granska', `${granska.length} av ${rader.length}`, granska.length ? 'skillnad över 5 %' : 'ingen skillnad över 5 %', granska.length > 0)
                     : _laSlutsats('Yrkesgrupper att granska', '–', `ingen yrkesgrupp har minst ${kTroskel()} av varje kön`),
        storst ? _laSlutsats('Största skillnaden', svPct(storst.kvot, 1), storst.yrke, false, 'Kvinnors medianlön i procent av mäns i den yrkesgrupp där skillnaden är störst') : '',
        regOk ? _laSlutsats('Kvar efter ålder och nivå', `${reg.konPct >= 0 ? '+' : ''}${svPct(reg.konPct, 1)}`, 'skillnad, kvinnor mot män', Math.abs(reg.konPct) > 5) : '',
        personer != null ? _laSlutsats('Personer att granska', svTal(personer, 0), `minst ${grans} % under förväntad lön`) : ''
    ].join('');
    _laNyckel('nyckel-la-yrkesgrupper', rader.length ? `${granska.length} att granska${folj.length ? ` · ${folj.length} att följa upp` : ''}` : '', granska.length > 0);
    _laNyckel('nyckel-la-personer', personer != null ? `${svTal(personer, 0)} ${personer === 1 ? 'person' : 'personer'}` : '');
    _laNyckel('nyckel-la-bas', basKvot.length ? `${basOver.length} av ${basKvot.length} över 5 %` : '', basOver.length > 0);
    _laNyckel('nyckel-la-kon', konRader.length ? `${ojamna} av ${konRader.length} ojämna` : '');
    _laNyckel('nyckel-la-regression', regOk ? `${reg.konPct >= 0 ? '+' : ''}${svPct(reg.konPct, 1)} oförklarat` : '', regOk && Math.abs(reg.konPct) > 5);
}

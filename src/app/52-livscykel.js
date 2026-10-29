// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Livscykelanalys (sekundär regression) ----
/**
 * Senast valt BAS för livscykelanalys (sparas mellan re-renders så användarens
 * val inte återställs varje gång regressionskortet renderas om).
 */
/** @type {string|null} */
let _lifecycleFixBas = null;

/**
 * Renderar livscykelanalys-fliken: klarspråklig rubrik,
 * översiktstabell över alla BAS, kurvor med 95 % KI-band, signifikanstest,
 * modelljämförelse + regelbaserad HR-coach.
 *
 * Anropas när fliken "Lön över karriären" (data-tab="kon") öppnas — livscykel-
 * panelen visas tillsammans med kön/ålder-kurvorna (sammanslagen flik).
 */
function renderLifecycleAnalysis() {
    // Flikens container är #livscykel-content (#lifecycle-content som reserv)
    const wrap = document.getElementById('livscykel-content') || document.getElementById('lifecycle-content');
    if (!wrap) return;

    const result = runLifecycleRegression(_lifecycleFixBas);
    if (result.error) {
        wrap.innerHTML = `<div class="insight-box warn pad-18">
            <strong>${ikon('statusVarning')} Livscykelanalysen kunde inte köras</strong>
            <p class="fs-md marg-8-0-0">${esc(result.error)}</p>
            <p class="text-dampad-sm marg-8-0-0">Analysen kräver minst 50 personer totalt, minst ${statGolv()} av varje kön och minst 2 BAS-intervall. Säkerställ också att kön-, ålders- och lönefält är korrekt mappade.</p>
        </div>`;
        return;
    }
    _lifecycleFixBas = result.fixBas;

    // Jämför vs primäranalysen (cachas inte — vi anropar den direkt)
    const primary = runOLSRegression();
    const primaryR2 = (primary && !primary.error) ? primary.R2 : null;
    const primaryAdjR2 = (primary && !primary.error) ? primary.adjR2 : null;
    const primaryGap = (primary && !primary.error) ? primary.konPct : null;
    const primaryP   = (primary && !primary.error) ? primary.pValue : null;

    const sigBadge = p => p < 0.001 ? `<span class="farg-kritisk">***</span>`
                       : p < 0.01  ? `<span class="farg-kritisk">**</span>`
                       : p < 0.05  ? `<span class="farg-varning">*</span>`
                       : '<span class="f-dampad">ns</span>';

    const basOptions = result.basList.map(b =>
        `<option value="${esc(b)}"${b === result.fixBas ? ' selected' : ''}>BAS ${esc(b)}</option>`
    ).join('');

    // Sammanfattningsrutor för gap-utveckling
    const gapStart = result.gapAt25;
    const gapEnd   = result.gapAt65;
    const gapKlass = (g) => Math.abs(g) > 5 ? 'fg-kritisk' : Math.abs(g) > 2 ? 'fg-varning' : 'fg-ok';

    // ====== B4: Översiktstabell — modellens lönenivåer per BAS ======
    // Modellen är en enda regression över alla BAS: kön×ålder-interaktionerna är gemensamma, så gapet i procent
    // vid 25 och 65 år är detsamma i alla intervall. Det som skiljer per BAS är nivån, och den kommer ur modellens
    // egna BAS-koefficienter (result.basFaktor = exp(β_BAS − β_visat)), inte ur uppmätta medianer.
    const basRows = result.basList.map(b => {
        const dB  = state.data.filter(r => r.bas === b && r.lon > 0);
        const skala = result.basFaktor?.[b] ?? 1.0;
        const kv25 = result.predKvinna[0].lon * skala;
        const kv65 = result.predKvinna[result.predKvinna.length - 1].lon * skala;
        const ma25 = result.predMan[0].lon * skala;
        const ma65 = result.predMan[result.predMan.length - 1].lon * skala;
        return {
            bas: b, n: dB.length,
            kv25, kv65, ma25, ma65,
            gap25Pct: result.gapAt25, gap65Pct: result.gapAt65,
            gap25Kr: kv25 - ma25, gap65Kr: kv65 - ma65   // kvinnor mot män: negativt när kvinnor ligger lägre
        };
    });

    // k-anonymitet: ett BAS-intervall under tröskeln har en koefficient skattad på få personers löner, så
    // kronvärdena skulle peka ut dem. Raden utelämnas helt — en rad där varenda kronkolumn står som "< 10" ger
    // inget att analysera — och BAS:et räknas upp i noten under tabellen.
    const basVisade = basRows.filter(r => !isKMasked(r.n));
    const basUtelamnade = basRows.filter(r => isKMasked(r.n)).map(r => r.bas);

    // ====== Modelljämförelse: vad livscykelmodellen tillför utöver huvudmodellen (justerat R²) ======
    // Står som en mening i tolkningen; talen finns i tabellen längst ned.
    const adjR2Delta = (primaryAdjR2 != null) ? (result.adjR2 - primaryAdjR2) * 100 : null;
    const modelMervarde = adjR2Delta != null
        ? (adjR2Delta < 1 ? 'liten' : adjR2Delta < 3 ? 'måttlig' : 'stor')
        : null;
    const modellMening = adjR2Delta != null
        ? ` Jämfört med huvudmodellen i Lika arbete förklarar livscykelmodellen ${adjR2Delta >= 0 ? '+' : '−'}${svTal(Math.abs(adjR2Delta), 1)} procentenheter mer av lönespridningen (${modelMervarde === 'stor' ? 'ett stort' : modelMervarde === 'måttlig' ? 'ett måttligt' : 'ett litet'} tillägg${modelMervarde === 'liten' ? '; den enklare modellen räcker' : ''}).`
        : '';

    // ====== B7: Regelbaserad HR-coach ======
    const interaktionSig = result.kvAgePVal < 0.10 || result.kvAge2PVal < 0.10;
    let coachKategori, coachRubrik, coachText;
    if (!interaktionSig) {
        coachKategori = 'konstant';
        coachRubrik = 'Konstant gap över karriären';
        coachText = `Kön×ålder-interaktionen är <strong>inte statistiskt säkerställd</strong> (p<sub>kön×ålder</sub> = ${result.kvAgePVal < 0.001 ? '< 0,001' : svTal(result.kvAgePVal, 3)}, p<sub>kön×ålder²</sub> = ${result.kvAge2PVal < 0.001 ? '< 0,001' : svTal(result.kvAge2PVal, 3)}). Lönegapet uppvisar ingen tydlig åldersvariation — eventuella skillnader är konstanta över karriärspannet. <strong>Att utforska:</strong> fokusera på strukturella analyser (BAS-värdering, likvärdigt arbete) snarare än karriärspecifika.`;
    } else if (result.gapDelta < -2) {
        coachKategori = 'växande';
        coachRubrik = 'Gapet växer med åldern';
        coachText = `Skillnaden är större i de högre åldrarna än i de lägre: kvinnors lön mot mäns sjunker med ${svTal(Math.abs(result.gapDelta), 1)} procentenheter mellan 25 och 65 år. Kurvorna är ett tvärsnitt och visar inte orsaken, men hypoteser att pröva är (1) <strong>föräldraledighet</strong> vars effekt samlas över karriären, (2) <strong>långsammare karriärväg</strong> för kvinnor — färre steg till högre BAS, (3) <strong>lönerevisioner som slår olika</strong> år efter år. <strong>Att utforska:</strong> granska lönerevisionshistorik per kön i era egna system (verktyget analyserar en kartläggning i taget), kontrollera befordringsstatistik per BAS-nivå, undersök om föräldralediga får samma lönelyft som heltidsarbetande.`;
    } else if (result.gapDelta > 2) {
        coachKategori = 'krympande';
        coachRubrik = 'Gapet krymper med åldern';
        coachText = `Skillnaden är mindre i de högre åldrarna än i de lägre: kvinnors lön mot mäns stiger med ${svTal(result.gapDelta, 1)} procentenheter mellan 25 och 65 år. Kurvorna är ett tvärsnitt och visar inte orsaken, men en hypotes att pröva är att <strong>skillnaden uppstår vid rekryteringen</strong>: kvinnor och män börjar med olika ingångslöner och ligger närmare varandra i de äldre grupperna. <strong>Att utforska:</strong> granska ingångslöner per kön och BAS, undersök rekryteringsprocessen, kontrollera lönesättningsdialog för nya medarbetare.`;
    } else {
        coachKategori = 'praktiskt konstant';
        coachRubrik = 'Gapet är praktiskt konstant';
        coachText = `Lönegapet är statistiskt åldersvarierande (p < 0,10) men förändringen är liten (${result.gapDelta >= 0 ? '+' : ''}${svTal(result.gapDelta, 1)} procentenheter). I praktiken är gapet stabilt över karriären. <strong>Att utforska:</strong> behandla som ett strukturellt gap — adressera via huvudregressionen och BAS-värderingen, inte via karriärspecifika insatser.`;
    }

    coachText += modellMening;

    // ====== UI ======
    wrap.innerHTML = `
        <!-- B2: Klarspråklig rubrik och intro -->
        <div class="insight-box info ram-v-4-accent marg-b-14">
            <strong>Vad analyserar livscykelmodellen?</strong>
            <p class="fs-md lh-1_55 marg-8-0">
                Den här analysen svarar på frågan: <em>"Är lönegapet mellan kvinnor och män
                konstant över karriären, eller växer/krymper det med åldern?"</em>
            </p>
            <ul class="fs-sm lh-1_6 marg-8-0 pad-v-22">
                <li><strong>Växande gap</strong> kan indikera långsammare karriärväg,
                    föräldraledighetseffekter eller lönerevisioner som slår olika.</li>
                <li><strong>Krympande gap</strong> kan tyda på att skillnaden uppstår vid rekryteringen:
                    kvinnor och män börjar med olika ingångslöner men kommer ikapp.</li>
                <li><strong>Konstant gap</strong> pekar på strukturella faktorer som bör
                    adresseras i lönekartläggningen, inte via karriärspecifika åtgärder.</li>
            </ul>
            <p class="text-dampad-sm marg-8-0-0">
                <em>Metod: utökad regression med kvadratisk åldersterm och
                kön×ålder-interaktioner. HC3-robusta standardfel. N = ${result.n}, R² = ${svPct((result.R2*100), 1)}.</em>
            </p>
        </div>

        <!-- B5: KPI:er + signifikanstest -->
        <div class="rutnat gap-12 kolumner-auto-180 marg-b-14">
            <div class="stat-box">
                <div class="stat-etikett fs-xs marg-0-0-4">Kvinnors lön mot mäns, 25 år</div>
                <div class="fs-xl fw-700 ${gapKlass(gapStart)}">${gapStart >= 0 ? '+' : ''}${svPct(gapStart, 1)}</div>
            </div>
            <div class="stat-box">
                <div class="stat-etikett fs-xs marg-0-0-4">Kvinnors lön mot mäns, 65 år</div>
                <div class="fs-xl fw-700 ${gapKlass(gapEnd)}">${gapEnd >= 0 ? '+' : ''}${svPct(gapEnd, 1)}</div>
            </div>
            <div class="stat-box">
                <div class="stat-etikett fs-xs marg-0-0-4">Förändring 25–65 år, procentenheter</div>
                <div class="fs-xl fw-700 ${Math.abs(result.gapDelta) > 1 ? 'fg-varning' : 'fg-ok'}">${result.gapDelta >= 0 ? '+' : ''}${svTal(result.gapDelta, 1)}</div>
                <div class="stat-under">minus: kvinnorna halkar efter</div>
            </div>
            <div class="stat-box" title="Test av om skillnaden förändras med åldern (kön×ålder). Vid p ≥ 0,10 är förändringen inte säkerställd.">
                <div class="stat-etikett fs-xs marg-0-0-4">Är förändringen säkerställd?</div>
                <div class="fs-md fw-600">
                    Linjär: p = ${result.kvAgePVal < 0.001 ? '< 0,001' : svTal(result.kvAgePVal, 3)} ${sigBadge(result.kvAgePVal)}<br>
                    Kvadratisk: p = ${result.kvAge2PVal < 0.001 ? '< 0,001' : svTal(result.kvAge2PVal, 3)} ${sigBadge(result.kvAge2PVal)}
                </div>
            </div>
        </div>

        <!-- B7: HR-coach baserad på mönster -->
        <div class="card mb-14 ${coachKategori === 'växande' ? 'bl4-kritisk' : coachKategori === 'krympande' ? 'bl4-varning' : coachKategori === 'konstant' ? 'bl4-accent' : 'bl4-ok'}">
            <h3 class="fs-lg marg-0-0-8">${coachRubrik}</h3>
            <p class="fs-md lh-1_6 marg-0">${coachText}</p>
        </div>

        <!-- BAS-dropdown + kurva -->
        <div class="card mb-14">
            <div class="rad-bryt-mitt gap-14 marg-b-8">
                <label for="lifecycle-bas-select" class="fs-sm fw-600">Visa lönekurvor för BAS-intervall:</label>
                <select id="lifecycle-bas-select" class="form-select pad-6-12 bredd-auto">${basOptions}</select>
            </div>
            <div id="lifecycle-chart"></div>
            <p class="livscykel-kohort-not text-dampad-xs lh-1_5 marg-8-0-0">${esc(KOHORT_FORBEHALL)}</p>
        </div>

        <!-- B4: Översiktstabell — gap-utveckling per BAS -->
        <details class="mb-14" open>
            <summary class="bak-upphojd rund-6 pekare fw-600 pad-10-14">
                Modellens lönenivåer per BAS-intervall vid 25 och 65 år
            </summary>
            <div class="pad-10-0">
                <table class="data-table st-088">
                    <thead>
                        <tr>
                            <th>BAS</th>
                            <th class="t-hoger" title="Antal personer i organisationens BAS-intervall">n</th>
                            <th class="t-hoger">Kvinna 25 år</th>
                            <th class="t-hoger">Man 25 år</th>
                            <th class="t-hoger" title="Kvinnors modellön minus mäns vid 25 år, för detta BAS-intervall; negativt när kvinnor ligger lägre">Skillnad 25 år (kr)</th>
                            <th class="t-hoger">Kvinna 65 år</th>
                            <th class="t-hoger">Man 65 år</th>
                            <th class="t-hoger" title="Kvinnors modellön minus mäns vid 65 år; negativt när kvinnor ligger lägre">Skillnad 65 år (kr)</th>
                            <th class="t-mitt">Bevis</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${basVisade.map((r) => `
                            <tr${r.bas === result.fixBas ? ' class="bg-ok-yta"' : ''}>
                                <td><strong>${esc(r.bas)}</strong>${r.bas === result.fixBas ? ' <small class="f-dampad">(visad)</small>' : ''}</td>
                                <td class="t-hoger">${r.n}</td>
                                <td class="t-hoger">${Math.round(r.kv25).toLocaleString('sv-SE')} kr</td>
                                <td class="t-hoger">${Math.round(r.ma25).toLocaleString('sv-SE')} kr</td>
                                <td class="t-hoger halvfet${r.gap25Kr < -1000 ? ' fg-varning' : ''}">${Math.round(r.gap25Kr).toLocaleString('sv-SE')} kr</td>
                                <td class="t-hoger">${Math.round(r.kv65).toLocaleString('sv-SE')} kr</td>
                                <td class="t-hoger">${Math.round(r.ma65).toLocaleString('sv-SE')} kr</td>
                                <td class="t-hoger halvfet${r.gap65Kr < -1000 ? ' fg-varning' : ''}">${Math.round(r.gap65Kr).toLocaleString('sv-SE')} kr</td>
                                <td class="t-mitt"><button class="btn-evidence" type="button" data-livscykel-bas="${esc(r.bas)}" title="Visa beräkningen för BAS ${esc(r.bas)}" aria-label="Bevis för BAS ${esc(r.bas)}">${ikon('sok')}</button></td>
                            </tr>`).join('')}
                    </tbody>
                </table>
                ${kMaskNote(basUtelamnade, 'BAS-intervall|BAS-intervall')}
                <p class="text-dampad-xs lh-1_5 marg-10-0-0">
                    <em>Talen är modellens lönenivåer, inte uppmätta medianer: kurvan räknas för det visade intervallet (${esc(result.fixBas)}) och övriga intervall får sin nivå ur modellens egna BAS-koefficienter. Skillnaden i procent, kvinnor mot män (${svPct(result.gapAt25, 1)} vid 25 år, ${svPct(result.gapAt65, 1)} vid 65), är densamma för alla intervall i modellen; kronorna skiljer eftersom lönenivåerna skiljer.</em>
                </p>
            </div>
        </details>

        <!-- B6: Detaljerad modelljämförelse -->
        <details class="mb-14" open>
            <summary class="bak-upphojd rund-6 pekare fw-600 pad-10-14">
                Detaljerad modelljämförelse: huvudmodell mot livscykelmodell
            </summary>
            <div class="pad-10-0">
                <table class="data-table fs-sm">
                    <thead>
                        <tr>
                            <th>Mått</th>
                            <th>Huvudmodell (BAS-indikatorer, linjär ålder)</th>
                            <th>Livscykelmodell (BAS-indikatorer, ålder² + interaktioner)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td><strong>Antal observationer (N)</strong></td><td>${primary ? primary.n : '—'}</td><td>${result.n}</td></tr>
                        <tr><td><strong>Antal parametrar (k)</strong></td><td>${primary ? primary.k : '—'}</td><td>${result.k}</td></tr>
                        <tr><td><strong>R²</strong></td><td>${primaryR2 != null ? svPct((primaryR2*100), 1) : '—'}</td><td>${svPct((result.R2*100), 1)}</td></tr>
                        <tr><td><strong>Justerat R²</strong></td><td>${primaryAdjR2 != null ? svPct((primaryAdjR2*100), 1) : '—'}</td><td>${svPct((result.adjR2*100), 1)}</td></tr>
                        <tr><td><strong>Löneskillnad kvinnor mot män</strong></td><td>${primaryGap != null ? (primaryGap >= 0 ? '+' : '') + svPct(primaryGap, 1) : '—'}</td><td>${(((Math.exp(result.kvCoef) - 1) * 100) >= 0 ? '+' : '')}${svPct(((Math.exp(result.kvCoef) - 1) * 100), 1)} (vid medelåldern ${Math.round(result.ageMean)} år)</td></tr>
                        <tr><td><strong>Kön — p-värde</strong></td><td>${primaryP != null ? (primaryP < 0.001 ? '< 0,001' : svTal(primaryP, 3)) : '—'} ${primaryP != null ? sigBadge(primaryP) : ''}</td><td>${result.kvPValue < 0.001 ? '< 0,001' : result.kvPValue.toFixed(3)} ${sigBadge(result.kvPValue)}</td></tr>
                        <tr><td><strong>Kön×ålder — p-värde</strong></td><td><em class="f-dampad">ej i modellen</em></td><td>${result.kvAgePVal < 0.001 ? '< 0,001' : svTal(result.kvAgePVal, 3)} ${sigBadge(result.kvAgePVal)}</td></tr>
                        <tr><td><strong>Kön×ålder² — p-värde</strong></td><td><em class="f-dampad">ej i modellen</em></td><td>${result.kvAge2PVal < 0.001 ? '< 0,001' : svTal(result.kvAge2PVal, 3)} ${sigBadge(result.kvAge2PVal)}</td></tr>
                    </tbody>
                </table>
                <p class="text-dampad-xs lh-1_5 marg-10-0-0">
                    <strong>Tolkningsregel:</strong> Är kön×ålder inte säkerställd (p ≥ 0,10) räcker huvudmodellen. Är den säkerställd döljer huvudmodellens enda tal att skillnaden varierar med åldern, och livscykelmodellen ger en mer fullständig bild.
                </p>
            </div>
        </details>

        <p class="text-dampad-xs lh-1_5 marg-t-10">
            <em>Modell: log(lön) ~ kön + ålder + ålder² + kön×ålder + kön×ålder² + C(BAS) med HC3-robusta standardfel. I kodningen är BAS ${esc(result.refBas)} referensintervall; kurvan ovan visas för det valda intervallet. Skuggade band i kurvan visar 95 % konfidensintervall för predicerad lön.</em>
        </p>
    `;

    // Cache result + basRows på state för bevis-handlern
    state._lifecycleCache = { result, basRows, primary };

    // Rita diagrammet efter DOM-uppdatering
    // I exportläget (ADR-51) ritas figuren direkt: exportgrinden läser den i samma varv som fliken ritas om.
    if (typeof iExportLage === 'function' && iExportLage()) _renderLifecycleChart(result);
    else requestAnimationFrame(() => _renderLifecycleChart(result));

    // Koppla BAS-dropdown
    const sel = document.getElementById('lifecycle-bas-select');
    if (sel) sel.addEventListener('change', () => {
        _lifecycleFixBas = /** @type {HTMLInputElement} */ (sel).value;
        renderLifecycleAnalysis();
    });

    // B8: Bevis-popup per BAS-rad
    wrap.querySelectorAll('.btn-evidence[data-livscykel-bas]').forEach(btn => {
        btn.addEventListener('click', () => {
            const bas = /** @type {HTMLElement} */ (btn).dataset.livscykelBas;
            const row = (state._lifecycleCache?.basRows || []).find(r => r.bas === bas);
            if (!row) return;
            if (isKMasked(row.n)) return;   // k-anonymitet: knappen ritas inte för
                                            // maskerade BAS, men vägen stängs även här
            _openEvidenceModal(_evidenceForLifecycleBas(row, state._lifecycleCache.result));
        });
    });
}

/**
 * Bygger bevis-payload för en BAS-rad i livscykelöversikten (B8).
 */
function _evidenceForLifecycleBas(row, result) {
    const fmtKr = v => v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('sv-SE') + ' kr';
    const fmtPct = v => v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '') + svPct(v, 1);
    return {
        title: `Bevis — BAS ${row.bas} (livscykelanalys)`,
        intro: `Predikterade lönenivåer från livscykelmodellen för BAS <strong>${esc(row.bas)}</strong>. Modellen är global (en regression över alla BAS samtidigt); nivån per BAS kommer ur modellens egen BAS-koefficient.`,
        rows: [
            { label: 'BAS-intervall',                       value: row.bas },
            { label: 'Antal personer i BAS (organisation)',  value: row.n.toLocaleString('sv-SE') },
            { label: 'Visat BAS-intervall',                 value: result.fixBas, note: 'Intervallet som lönekurvan räknas för direkt. Övriga intervall får sin nivå ur sin BAS-koefficient.' },
            { label: 'Nivåfaktor mot visat intervall',      value: result.basFaktor?.[row.bas] != null ? svTal(result.basFaktor[row.bas], 3) : '—', note: 'exp(β_BAS − β_visat); 1,000 för det visade intervallet.' },
            { label: '— Predikterad lön vid 25 år',         value: '' },
            { label: 'Kvinna',                              value: fmtKr(row.kv25) },
            { label: 'Man',                                  value: fmtKr(row.ma25) },
            { label: 'Skillnad, kvinnor mot män (kr)',      value: fmtKr(row.gap25Kr), note: `I procent: ${fmtPct(row.gap25Pct)}` },
            { label: '— Predikterad lön vid 65 år',         value: '' },
            { label: 'Kvinna',                              value: fmtKr(row.kv65) },
            { label: 'Man',                                  value: fmtKr(row.ma65) },
            { label: 'Skillnad, kvinnor mot män (kr)',      value: fmtKr(row.gap65Kr), note: `I procent: ${fmtPct(row.gap65Pct)}` },
            { label: '— Modellstatistik',                   value: '' },
            { label: 'Kön×ålder (linjär) p-värde',          value: result.kvAgePVal < 0.001 ? '< 0,001' : svTal(result.kvAgePVal, 4) },
            { label: 'Kön×ålder² (kvadratisk) p-värde',     value: result.kvAge2PVal < 0.001 ? '< 0,001' : svTal(result.kvAge2PVal, 4) },
            { label: 'Förändring 25–65 år',                     value: (result.gapDelta >= 0 ? '+' : '') + svTal(result.gapDelta, 2) + ' procentenheter', note: 'Kvinnors lön mot mäns; minus betyder att kvinnorna halkar efter.' }
        ],
        formula: `<strong>Beräkning av predikterad lön per BAS:</strong><br>
            För referens-BAS "${result.fixBas}" beräknas direkt från modellen:<br>
            ln(lön) = β₀ + β_kön·isKv + β_ålder·(ålder−medel) + β_ålder²·(ålder−medel)² + β_kön×ålder·... + Σβ_BAS·dummies<br><br>
            För andra BAS ger modellens BAS-koefficient nivån:<br>
            lön(BAS) = lön(${result.fixBas}) × <em>exp(β_BAS − β_${result.fixBas})</em><br><br>
            <em>Notera: detta är en additiv modell — BAS påverkar nivån men inte gap-utvecklingen. Därför är procent-gapet identiskt över alla BAS, men kronvärdet skiljer eftersom lönenivåerna skiljer.</em>`,
        footer: `Livscykelmodellen tillåter att gapet varierar med åldern (via kön×ålder-interaktioner). Är interaktionerna ej signifikanta (p ≥ 0,10) är gapet i praktiken konstant — då räcker huvudregressionen. Är de signifikanta måste karriärspecifika åtgärder övervägas.`
    };
}

/**
 * Ritar livscykelanalysens diagram med diagramkärnan (ADR-39): två kurvor med 95 % KI som band.
 * Bandens gränser finns därmed i exporterad diagramdata.
 */
function _renderLifecycleChart(r) {
    ritaFigur('lifecycle-chart', _lifecycleFigur(r), { hojd: 380 });
}

function _lifecycleFigur(r) {
    const band = (serie, farg, pred) => ({ marke: 'band', serie, farg, opacitet: 0.18, legend: false, data: pred.map(p => ({ x: p.age, lag: p.lo, hog: p.hi })) });
    const kurva = (serie, kon, farg, pred, streck) => ({ marke: 'linje', serie, farg, tjocklek: 3, streck, data: pred.map(p => ({ x: p.age, y: p.lon })),
        tips: d => [[`${kon}, ${d.x} år`], ['Predikterad lön', _figTalformat(d.y, 'kr')]] });
    return { beskrivning: `Predikterade lönekurvor för kvinnor och män, ålder 25 till 65, vid BAS ${r.fixBas} (valt intervall). ` +
            `Vid 25 år är skillnaden, kvinnor mot män, ${svTal(r.gapAt25, 1)} procent, vid 65 år ${svTal(r.gapAt65, 1)} procent. Skuggade band visar 95 % konfidensintervall.`,
        x: { skala: 'linjar', titel: `Ålder — predikterad lönekurva för BAS ${r.fixBas} (valt intervall)` },
        y: { skala: 'linjar', titel: 'Predikterad månadslön (kr)', format: 'kr' },
        lager: [band('Kvinna 95 % KI', PALETTE.kon.kvinna, r.predKvinna), band('Man 95 % KI', PALETTE.kon.man, r.predMan),
                kurva('Kvinna (predikterad lön)', 'Kvinna', PALETTE.kon.kvinna, r.predKvinna, 'hel'),
                kurva('Man (predikterad lön)', 'Man', PALETTE.kon.man, r.predMan, 'streckad')] };
}

/**
 * Sekundär livscykelanalys (utökad modell):
 *   log(lön) ~ kön + ålder + ålder² + kön×ålder + kön×ålder² + C(BAS)
 *
 * Skillnader mot primäranalysen:
 *   1. Kvadratisk åldersterm — fångar inverterad-U-form (lön planar ut sent i karriären)
 *   2. Kön×ålder och kön×ålder²-interaktioner — gapet kan växa/krympa med ålder
 * BAS kodas som indikatorer (första BAS = referens), precis som i huvudmodellen.
 *
 * Returnerar koefficienter + prediktionspunkter med 95 % KI för visualisering.
 *
 * @param {string} fixBas - BAS-intervall att fixera vid i visualiseringen (default = mest folkrika)
 * @returns {Object} { error } eller fullt resultat med predKvinna, predMan, gapPerAge, model fit
 */
/** @param {string|null} [fixBas] BAS-intervall att fixera vid; null = det mest folkrika */
function runLifecycleRegression(fixBas) {
    // Modellen (designmatris, OLS, HC3, prediktioner) ligger i src/lib/livscykel.js (ADR-8).
    const res = _lcLivscykelRegression(getData(), { fixBas, golv: statGolv() });
    if (res.error) return res;

    const { gapAt25, gapAt65, gapDelta, kvAgePVal, kvAge2PVal } = res;
    // Tolkningstexten är presentation och hör därför till appen.
    let interpretation;
    if (kvAgePVal > 0.10 && kvAge2PVal > 0.10) {
        interpretation = 'Gapet är **konstant över karriären** (kön×ålder-interaktionen är ej statistiskt signifikant).';
    } else if (gapDelta < -1) {
        interpretation = `Gapet **växer med åldern** — från ${svPct(gapAt25, 1)} vid 25 år till ${svPct(gapAt65, 1)} vid 65 år. Kan indikera glasstaks-mönster och behöver granskas.`;
    } else if (gapDelta > 1) {
        interpretation = `Gapet **krymper med åldern** — från ${svPct(gapAt25, 1)} vid 25 år till ${svPct(gapAt65, 1)} vid 65 år. Kan indikera ikapphämtning över karriären.`;
    } else {
        interpretation = `Gapet är **i princip konstant** över åldersspannet (${svPct(gapAt25, 1)} till ${svPct(gapAt65, 1)}).`;
    }

    return { ...res, interpretation };
}

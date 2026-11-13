// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

/**
 * Huvudregression för "oförklarad löneskillnad" (EU 2023/970, Medlingsinstitutet).
 *
 * Modell: log(lön) ~ kön + ålder (centrerad) + BAS-intervall (indikatorvariabler).
 * Returnerar koefficienter med HC3-robusta standardfel + p-värden, R², och
 * en steg-för-steg dekomposition (gap utan kontroll → +BAS → +ålder) som
 * vattenfallsdiagrammet bygger på. Konverterar log-koefficienten till
 * approximativ kr-procentskillnad: gapPct = (exp(β) − 1) · 100.
 *
 * BAS kodas som en indikator per BAS-intervall utom det första (alfabetiskt lägsta) som är
 * referens: varje intervall får sin egen lönenivå, utan antagandet att varje bokstavssteg
 * är värt lika mycket. Ordningen A–J är ändå fast (se §5 i teknisk-plan.md) och styr
 * vilket intervall som blir referens.
 * @returns {{error?: string, errorCode?: string, [k: string]: any}} vid fel { error, errorCode } (ev. triedSteps, diagnostics);
 *   annars beta, se, p, R2, n, k, gapPct, decomposition m.fl. — se return-satsen.
 */
function runOLSRegression() {
    // Utan ålder i lönefilen (ADR-64) används alla rader och modellen räknas utan ålder.
    const medAlder = harAlder();
    const raw = getData().filter(d => d.lon > 0 && (!medAlder || d.alder > 0) && (d.kon.includes('kvinna') || d.kon === 'man' || d.kon === 'män'));
    if (raw.length < 30) return { error: 'För få observationer (n < 30) för meningsfull regressionsanalys.', errorCode: 'low_n' };

    const kvN = raw.filter(d => d.kon.includes('kvinna')).length;
    const maN = raw.filter(d => d.kon === 'man' || d.kon === 'män').length;
    if (kvN < 5 || maN < 5)
        return { error: `Otillräcklig könsbalans i urvalet: ${kvN} kvinnor, ${maN} män. Minst 5 av varje kön krävs.`, errorCode: 'imbalance' };

    const basList = [...new Set(raw.map(d => d.bas))].sort();
    // Indikatorvariabler: en kolumn per BAS-intervall utom det första, som är referens.
    const basRef0 = basList[0];
    const basInd = _basIndikatorer(basList);

    const ageMean = medAlder ? raw.reduce((s,d) => s + d.alder, 0) / raw.length : 0;

    const y    = raw.map(d => Math.log(d.lon));
    const isKv = raw.map(d => d.kon.includes('kvinna') ? 1 : 0);
    const ageC = raw.map(d => d.alder - ageMean);
    const basD = raw.map(d => basInd.map(b => (d.bas === b ? 1 : 0)));

    // Förklaringsmodellen (ADR-56): vilka variabler som räknas bort. "Endast kön" är det ojusterade gapet, som inte får
    // lämna verktyget när ett kön ligger under den inställda tröskeln (ADR-12); huvudtalet ska vara detsamma på skärmen
    // och i exporten, så spärren följer den inställda tröskeln oavsett läge (som statGolv). Då gäller standardmodellen
    // och panelen säger varför.
    let modell = forklaringsmodell();
    /** @type {string|null} */ let modellVarning = null;
    if (!modell.bas && !modell.alder && !(kvN >= kInstalld() && maN >= kInstalld())) {
        modell = { ...modell, bas: true, alder: medAlder };
        modellVarning = `Endast kön kan inte väljas: ett kön har färre än ${kInstalld()} ${personOrd(kInstalld())} i modellen (minsta gruppstorlek), så den ojusterade skillnaden får inte vara huvudtalet. Modellen är kön + BAS-intervall${medAlder ? ' + ålder' : ''}.`;
    }

    // Kolumnordningen är fast: [1, kön, (ålder), (BAS-indikatorer)], så att index 2 är ålder när den är vald.
    const buildX = (incAge, incBas) => raw.map((d,i) => {
        const r = [1, isKv[i]];
        if (incAge) r.push(ageC[i]);
        if (incBas) r.push(...basD[i]);
        return r;
    });
    const beskriv = m => _rgModellBeskrivning(m);
    // Reservstegen tar bort variabler i ordningen yrkesgrupp, BAS; inget bortvalt läggs tillbaka. 'full' = den valda modellen.
    const ladder = [];
    if (modell.yrkesgrupp) ladder.push({ name: 'full', desc: beskriv(modell), yrke: true });
    const utanYrke = { ...modell, yrkesgrupp: false };
    ladder.push({ name: modell.yrkesgrupp ? 'utanYrke' : 'full', desc: beskriv(utanYrke), X: buildX(utanYrke.alder, utanYrke.bas) });
    if (modell.bas) { const m2 = { ...utanYrke, bas: false }; ladder.push({ name: 'minimal', desc: beskriv(m2), X: buildX(m2.alder, false) }); }

    const triedSteps = [];
    /** @type {any} */
    let chosen = null;
    for (const step of ladder) {
        if (step.yrke) {
            const fit = _regInomYrkesgrupp(raw, y, isKv, ageC, modell.alder);
            if (!fit) { triedSteps.push({ name: step.name, desc: step.desc, status: 'singular', k: null }); continue; }
            triedSteps.push({ name: step.name, desc: step.desc, status: 'ok', k: fit.k });
            chosen = { ...fit, modelName: step.name, modelDesc: step.desc };
            break;
        }
        if (raw.length < step.X[0].length + 5) {
            triedSteps.push({ name: step.name, desc: step.desc, status: 'too_few', k: step.X[0].length });
            continue;
        }
        const fit = _fitOLS(step.X, y);
        if (!fit) {
            triedSteps.push({ name: step.name, desc: step.desc, status: 'singular', k: step.X[0].length });
            continue;
        }
        triedSteps.push({ name: step.name, desc: step.desc, status: 'ok', k: step.X[0].length });
        chosen = { ...fit, modelName: step.name, modelDesc: step.desc };
        break;
    }

    if (!chosen)
        return {
            error: 'Modellen kunde inte estimeras.',
            errorCode: 'all_failed',
            triedSteps,
            diagnostics: _diagnoseCollinearity(raw, basList)
        };
    // Den modell som faktiskt skattades (reservsteget kan ha tagit bort variabler).
    const skattad = chosen.modelName === 'full' ? modell : chosen.modelName === 'utanYrke' ? utanYrke : { ...utanYrke, bas: false };

    // Kön-koefficient (index 1) – HC3 robusta standardfel
    const betaKon  = chosen.beta[1];
    const seKonR   = Math.sqrt(chosen.vcovHC3[1][1]);
    const seKonC   = Math.sqrt(chosen.vcovClassic[1][1]);
    const tStat    = betaKon / seKonR;
    const pValue   = _pValue2Sided(tStat, chosen.n, chosen.k);
    const pct      = (Math.exp(betaKon) - 1) * 100;
    // Halvbredden för 95 % KI: t-fördelningens kvantil vid df = n − k (1,96 först vid df ≥ 100)
    const tq       = _tQuantile(0.975, chosen.n - chosen.k);
    const pctLow   = (Math.exp(betaKon - tq*seKonR) - 1) * 100;
    const pctHigh  = (Math.exp(betaKon + tq*seKonR) - 1) * 100;
    const pctLowC  = (Math.exp(betaKon - tq*seKonC) - 1) * 100;
    const pctHighC = (Math.exp(betaKon + tq*seKonC) - 1) * 100;

    // Ålders-koefficient (index 2): % per år. null när ålder inte är med i modellen.
    /** @type {number|null} */ let ageEffect = null;
    /** @type {number|null} */ let ageP = null;
    if (skattad.alder) {
        const betaAge   = chosen.beta[2];
        const seAge     = Math.sqrt(chosen.vcovHC3[2][2]);
        ageEffect = (Math.exp(betaAge) - 1) * 100;
        ageP      = _pValue2Sided(betaAge/seAge, chosen.n, chosen.k);
    }

    // BAS-koefficienter: lönenivå per BAS-intervall i procent mot referensintervallet, när BAS-indikatorerna är med
    // (null i reservmodellen och när yrkesgrupp inom BAS är vald, där BAS ingår i gruppnivåerna).
    let basEffekter = null;
    if (skattad.bas && !skattad.yrkesgrupp) {
        const forsta = skattad.alder ? 3 : 2;
        basEffekter = basInd.map((b, j) => {
            const idx = forsta + j;
            const beta = chosen.beta[idx];
            const se   = Math.sqrt(chosen.vcovHC3[idx][idx]);
            return {
                bas: b,
                pct: (Math.exp(beta) - 1) * 100,
                low: (Math.exp(beta - tq*se) - 1) * 100,
                high: (Math.exp(beta + tq*se) - 1) * 100,
                p: _pValue2Sided(beta/se, chosen.n, chosen.k)
            };
        });
    }
    const basRef = skattad.bas ? basRef0 : null;

    // Sekventiell dekomponering på den skattade modellen.
    // Ansvarssteget lyfts ut: det redovisas på en egen rad och påverkar inte huvudtalet.
    const allaSteg = _computeSequentialGap(raw, ageMean, basList, skattad);
    const ansvarSteg = allaSteg.find(s => s.name === '+ Ansvar') ?? null;
    // Yrkesgruppssteget (ADR-46) står sist i sequential. Är yrkesgrupp vald (ADR-56) är det huvudtalet; annars visas
    // det efter huvudtalet, och huvudtalet och den förklarade andelen räknas till och med modellens sista OLS-steg.
    const yrkesSteg = allaSteg.find(s => s.name === '+ Yrkesgrupp') ?? null;
    const sequential = allaSteg.filter(s => s.name !== '+ Ansvar');
    const seqOk = sequential.filter(s => s.status === 'ok' && (skattad.yrkesgrupp || s.name !== '+ Yrkesgrupp'));
    /** @type {number|null} */ let explainedShare = null;
    if (seqOk.length >= 2) {
        const first = Number(seqOk[0].gapPct);
        const last  = Number(seqOk[seqOk.length - 1].gapPct);
        if (Math.abs(first) > 0.1) {
            explainedShare = ((Math.abs(first) - Math.abs(last)) / Math.abs(first)) * 100;
        }
    }

    // Vad varje variabel tillför (ADR-56), alltid mot fullmodellen, och det som valts bort med sina tal.
    const tillfor = _computeVariabelTillfor(raw, ageMean, basList);
    const etikett = { bas: 'BAS-intervall', alder: 'Ålder' };
    const bortvalt = ['bas', 'alder'].filter(v => !modell[v]).map(v => {
        const rad = tillfor.rader.find(r => r.variabel === v);
        return { variabel: v, etikett: etikett[v], deltaR2pp: rad ? rad.deltaR2pp : null, gapUtan: rad ? rad.gapUtan : null, gapMed: rad ? rad.gapMed : null, skal: modell.skal };
    });

    // Per-BAS conditional gap (separata regressioner inom varje BAS)
    const perBas = _computePerBasGap(raw, basList);

    const fellBackFromFull = chosen.modelName !== 'full';
    const diagnostics = fellBackFromFull ? _diagnoseCollinearity(raw, basList) : [];

    // Rått gap (median)
    const kv = raw.filter(d => d.kon.includes('kvinna'));
    const ma = raw.filter(d => d.kon === 'man' || d.kon === 'män');
    const medianKv = Stat.median(kv.map(d=>d.lon));
    const medianMa = Stat.median(ma.map(d=>d.lon));
    const rawGapPct = (medianKv / medianMa - 1) * 100;

    return {
        modelName: chosen.modelName,
        modelDesc: chosen.modelDesc,
        modell: skattad,                      // den skattade förklaringsmodellen (ADR-56)
        modellVald: modell,                   // den valda (skiljer sig från modell bara i reservsteget)
        modellVarning,
        fras: _rgModellFras(skattad),         // "ålder och BAS-intervall" m.fl.; tom för endast kön
        tillfor,
        bortvalt,
        fellBackFromFull,
        triedSteps,
        diagnostics,
        n: chosen.n, k: chosen.k, ageMean,
        hHoga: chosen.hHoga ?? 0,             // observationer med hävstång > 0,99 (B4, teknisk specifikation)
        konPct: pct, konPctLow: pctLow, konPctHigh: pctHigh,
        // Samma skattning som kvinnors lön i % av mäns (log-modellen: exp(β) × 100 = 100 + konPct), måttet i
        // flikarnas nyckeltalsrader.
        konKvot: 100 + pct,
        konPctLowClassical: pctLowC, konPctHighClassical: pctHighC,
        seKonR, seKonC,
        tStat, pValue, tKvantil: tq,          // halvbredden för 95 % KI i enheter av SE
        ageEffect, ageP,
        basEffekter,                          // per BAS-intervall utom referensen: nivå mot referensen (null vid reservmodell)
        basRef,                               // referensintervallet (alfabetiskt första)
        basList,                              // alfabetiskt sorterad lista, för referens i UI
        R2: chosen.R2, adjR2: chosen.adjR2,
        rawGapPct,
        medianKv, medianMa,                   // underlag för kronor-omräkningen i UI
        sequential,
        ansvarSteg,
        yrkesSteg,
        explainedShare,
        perBas,
        nBas: basList.length,
        nKvAnalysed: kvN, nMaAnalysed: maN
    };
}

/**
 * Huvudregressionen med yrkesgrupp inom BAS (ADR-56): fasta effekter för AID×BAS med inomtransformation (ADR-46),
 * som steget + Yrkesgrupp, men här behövs också standardfel. Skattningen görs på de transformerade variablerna
 * [kön, (ålder)]; koefficienterna är desamma som med en indikator per grupp (Frisch–Waugh–Lovell). Kovarianserna
 * (klassisk och HC3) skalas med (n − p) / (n − p − G) för gruppnivåernas frihetsgrader, och k räknas med dem, så att
 * t-kvantilen och p-värdet använder rätt df. Resultatet får samma form som fitOLS med intercept (index 0 är en
 * tom konstant), så att resten av runOLSRegression läser kön på index 1 och ålder på index 2.
 * hHoga räknas på den inomtransformerade designen, den som HC3 här räknas på.
 * @returns {null | {beta:number[], vcovHC3:number[][], vcovClassic:number[][], R2:number, adjR2:number, n:number, k:number, rss:number, hHoga:number}}
 */
function _regInomYrkesgrupp(raw, y, isKv, ageC, medAlder) {
    const kol = raw.map((_, i) => (medAlder ? [isKv[i], ageC[i]] : [isKv[i]]));
    const inom = _rgInomYrkesgrupp(raw, y, kol);
    if (!inom.ok) return null;
    const fit = _fitOLS(inom.X, inom.yW);
    if (!fit) return null;
    const n = raw.length, p = kol[0].length, k = inom.k;
    if (n - k <= 0) return null;
    const skala = (n - p) / (n - k);
    const vidga = V => { const ut = [[0, ...V[0].map(() => 0)]]; for (const rad of V) ut.push([0, ...rad.map(v => v * skala)]); return ut; };
    const R2 = inom.R2Total(fit.rss);
    return { beta: [0, ...fit.beta], vcovHC3: vidga(fit.vcovHC3), vcovClassic: vidga(fit.vcovClassic), R2,
        adjR2: 1 - (1 - R2) * (n - 1) / (n - k), n, k, rss: fit.rss, hHoga: fit.hHoga };
}

function _formatPValue(p) {
    if (p < 0.001) return 'p < 0,001';
    if (p < 0.01)  return 'p < 0,01';
    if (p < 0.05)  return 'p < 0,05';
    return 'p = ' + svTal(p, 3);
}

// Plain-text tolkning av p-värdet, används som tooltip
function _sigPlainText(p) {
    // p = sannolikheten att få en minst så stor skillnad OM det inte fanns någon
    // verklig skillnad — inte sannolikheten att resultatet "beror på slump".
    if (p < 0.001) return 'Extremt signifikant: om det inte fanns någon verklig skillnad skulle en så stor skillnad uppstå av slump i färre än 1 av 1 000 fall. Mycket starkt stöd för en verklig löneskillnad.';
    if (p < 0.01)  return 'Mycket signifikant: om det inte fanns någon verklig skillnad skulle en så stor skillnad uppstå av slump i färre än 1 av 100 fall. Starkt stöd för en verklig skillnad.';
    if (p < 0.05)  return 'Signifikant: om det inte fanns någon verklig skillnad skulle en så stor skillnad uppstå av slump i färre än 5 av 100 fall. Den vanliga tröskeln för en "statistiskt säkerställd" skillnad.';
    return `Ej signifikant (p=${svTal(p, 3)}): datat är förenligt med att ingen verklig skillnad finns. Observerad skillnad kan vara slumpvariation.`;
}

// ---- Pedagogik-hjälpare för den multivariata analysen -----------------------
// Rena funktioner (testbara) som översätter regressionens procenttal till något
// en läsare utan statistikbakgrund kan förhålla sig till.

/**
 * Översätter den oförklarade kön-effekten till kronor.
 *
 * Modellen är multiplikativ på log-skalan: kvinnas lön = mans lön × (1 + konPct/100).
 * Vi använder männens medianlön som referens och räknar ut vad modellen förutsäger
 * för en kvinna med SAMMA ålder och SAMMA BAS-placering. Skillnaden är den
 * oförklarade delen uttryckt i kronor.
 *
 * OBS: en storleksordning för att göra procenten begriplig — INTE en
 * åtgärdskostnad (den beräknas mot faktiska individlöner i Löneöversyn).
 * @returns {null|{refMan:number, refKvinna:number, krMonth:number, krYear:number, krTotalYear:number}}
 */
function _regressionKronor(r) {
    if (!r || typeof r.konPct !== 'number' || !isFinite(r.konPct) || !(r.medianMa > 0)) return null;
    const refMan = r.medianMa;
    const refKvinna = refMan * (1 + r.konPct / 100);
    const krMonth = refMan - refKvinna;          // > 0 när kvinnor ligger under
    return {
        refMan, refKvinna, krMonth,
        krYear: krMonth * 12,
        krTotalYear: krMonth * 12 * (r.nKvAnalysed || 0)
    };
}

/**
 * Ansvarsradens mening under förklaringsbudgeten, med tecken: fore = oförklarad skillnad efter
 * ålder och BAS, efter = med ansvaret inräknat (båda i procent, kvinnor mot män).
 */
function _ansvarRadText(fore, efter) {
    const sv = v => v.toFixed(2).replace('.', ',');
    const tkn = v => `${v >= 0 ? '+' : '−'}${sv(Math.abs(v))} %`;
    const namn = 'Ansvar (ledningsansvar, särskilt uppdrag)';
    if (fore !== 0 && efter !== 0 && Math.sign(fore) !== Math.sign(efter)) {
        return `<strong>${namn}: med ansvaret inräknat byter skillnaden riktning, från ${tkn(fore)} till ${tkn(efter)}.</strong>`;
    }
    const forklarat = Math.abs(fore) - Math.abs(efter);
    return forklarat >= 0
        ? `<strong>${namn} förklarar ytterligare ${sv(forklarat)} procentenheter</strong>; med ansvaret inräknat är den oförklarade skillnaden ${tkn(efter)} (före ${tkn(fore)}).`
        : `<strong>${namn} förklarar inget av skillnaden</strong> — med ansvaret inräknat blir den större, ${tkn(efter)} (före ${tkn(fore)}).`;
}

/**
 * Meningen under yrkesgruppssteget (ADR-46): vad talet är och vad det bygger på. Ren funktion, delas med
 * rapportmodellen. `modell` är den skattade förklaringsmodellen (ADR-56): steget räknas med ålder när modellen har
 * ålder, och är huvudtalet när yrkesgrupp är vald.
 * @param {any} s @param {{alder: boolean, yrkesgrupp: boolean}} modell
 */
function _yrkesStegText(s, modell) {
    const sv = v => v.toFixed(1).replace('.', ',');
    const tkn = v => `${v >= 0 ? '+' : '−'}${sv(Math.abs(v))} %`;
    return `<strong>${tkn(s.gapPct)}</strong> är löneskillnaden mellan kvinnor och män med samma yrkesgrupp, BAS-intervall${modell.alder ? ' och ålder' : ''} `
        + `(fasta effekter för yrkesgrupp inom BAS). Bygger på ${s.nPersoner} personer i ${s.nGrupperBada} yrkesgrupper där båda könen finns`
        + (s.nEnkonade ? `; ${s.nEnkonade} enkönade grupper bidrar inte` : '')
        + (modell.yrkesgrupp ? '. Yrkesgrupp inom BAS är vald i förklaringsmodellen, så det här är huvudtalet.' : '. Huvudtalet ovan räknar inte bort yrkesgruppen.');
}

/**
 * Texten om korrigeringen för många samtidiga tester, räknad ur antalet tester (allM, ett per BAS-intervall med
 * tillräcklig könsbalans). Under fem tester räcker en mening; utan tester ingen text.
 * @param {number} n
 */
function _bhTextFor(n) {
    if (!(n > 0)) return '';
    if (n === 1) return 'Här körs ett enda test, så ingen justering för många samtidiga tester behövs.';
    if (n < 5) return `Här körs ${n} tester samtidigt; varningstriangeln markerar grupper som är säkerställda i det råa p-värdet men inte efter justeringen enligt Benjamini–Hochberg.`;
    return `Här körs ${n} tester samtidigt. Med enbart rå p < 0,05 väntas ungefär ${svTal(n * 0.05, 1)} falskt positiva resultat av ren slump. `
        + 'Justeringen enligt Benjamini–Hochberg minskar den risken genom att kräva starkare bevis för grupper som prövas tillsammans. '
        + 'Varningstriangeln markerar grupper som är säkerställda i det råa p-värdet men inte efter justeringen; de bör inte presenteras som säkerställda.';
}

/** Meningen om ordningsberoendet under förklaringsbudgeten (S5): stegens ordning avgör vad som tillskrivs varje steg. */
function _budgetOrdningNot(budget) {
    if (!budget || budget.parts.length < 2) return '';
    const namn = { bas: 'BAS', alder: 'ålder', yrke: 'yrkesgrupp inom BAS' };
    return `<p class="rb-note">Stegen läggs till i ordningen ${esc(budget.parts.map(p => namn[p.key] || p.key).join(', '))}; vad som tillskrivs varje steg beror på ordningen. Kortet Vad varje variabel tillför mäter varje variabel ovanpå alla andra.</p>`;
}

/**
 * Bygger "förklaringsbudgeten": hur många procentenheter av det ursprungliga
 * gapet som varje kontrollvariabel åt upp, och hur mycket som blir kvar.
 *
 * En kontroll kan göra gapet STÖRRE (negativt bidrag) — det betyder att den
 * strukturella faktorn dolde en del av skillnaden. Det flaggas separat i stället
 * för att ritas som en stapel.
 * @param {Array} seqOk - sequential-stegen med status 'ok'.
 * @returns {null|{g0:number, remaining:number, parts:Array, denom:number, anyNegative:boolean, remainingShare:number}}
 */
function _explanationBudget(seqOk) {
    if (!Array.isArray(seqOk) || seqOk.length < 2) return null;
    const ok = seqOk.filter(s => typeof s.gapPct === 'number');
    if (ok.length < 2 || ok[0].name !== 'Endast kön') return null;
    const g0 = Math.abs(ok[0].gapPct);
    if (!(g0 > 0)) return null;
    // En del per steg efter det första, i den ordning stegen kommer (ADR-56: ordningen följer den valda modellen).
    const nyckel = { '+ BAS-intervall': 'bas', '+ Ålder': 'alder', '+ Yrkesgrupp': 'yrke' };
    const etikett = { bas: 'Förklaras av BAS-placering', alder: 'Förklaras av ålder', yrke: 'Förklaras av yrkesgrupp inom BAS' };
    const parts = [];
    for (let i = 1; i < ok.length; i++) {
        const key = nyckel[ok[i].name];
        if (!key) continue;
        parts.push({ key, label: etikett[key], val: Math.abs(ok[i - 1].gapPct) - Math.abs(ok[i].gapPct) });
    }
    if (!parts.length) return null;
    const last = Math.abs(ok[ok.length - 1].gapPct);

    const anyNegative = parts.some(p => p.val < -0.005);
    const posSum = parts.reduce((s, p) => s + Math.max(0, p.val), 0);
    const denom = Math.max(0.01, posSum + last);
    parts.forEach(p => { p.share = (Math.max(0, p.val) / denom) * 100; });
    return { g0, remaining: last, parts, denom, anyNegative, remainingShare: (last / denom) * 100 };
}

/**
 * Per-BAS-diagram: det justerade (åldersrensade) gapet per BAS-intervall som
 * punkter med 95 % KI mot nollinjen. Tabellen finns kvar som a11y-alternativ.
 */
function _renderPerBasGapChart(perBas, bhQByBas) {
    const el = document.getElementById('chart-perbas-gap');
    if (!el) return;
    const ok = (perBas || []).filter(p => p.status === 'ok' && isFinite(p.gapPct));
    if (ok.length < 2) {
        rensaFigur(el);
        el.innerHTML = '<p class="text-dampad-sm marg-8-0">För få BAS-intervall med tillräcklig könsbalans för ett diagram — se tabellen nedan.</p>';
        return;
    }
    ritaFigur(el, _perBasFigur(ok.slice().sort((a, b) => a.gapPct - b.gapPct), bhQByBas));
}

// Figuren (diagramkärnan, ADR-39): en punkt med 95 % konfidensintervall mot nollinjen (inget oförklarat gap). Det som
// ska läsas är om intervallet når noll, och det syns direkt. Statusen är en serie med egen symbol — färgen bär den
// inte ensam (förbättring 7). Säkerställt och minst 3 % är samma regel som *Värt att granska* (ADR-59) och har därför
// samma lila; rött används inte för en skillnad i procent (10-diagramtema.js, GAP_STATUS). Regressionens tal är
// justerade och bär aldrig direktivmarkeringen.
// `sorted` är bara BAS med status 'ok' (tillräcklig könsbalans); inga andra når figuren.
const _PERBAS_STATUS = [
    { serie: 'Säkerställt, minst 3 %', farg: 'granska', symbol: 'romb' },
    { serie: 'Säkerställt', farg: 'varning', symbol: 'kvadrat' },
    { serie: 'Inte säkerställt', farg: 'neutral', symbol: 'cirkel' }
];
function _perBasDoman(sorted) {
    const lag = Math.min(0, ...sorted.map(p => Math.min(p.ciLow, p.gapPct))), hog = Math.max(0, ...sorted.map(p => Math.max(p.ciHigh, p.gapPct)));
    const luft = Math.max(0.5, (hog - lag) * 0.06);
    return [Math.floor((lag - luft) * 2) / 2, Math.ceil((hog + luft) * 2) / 2];
}
function _perBasFigur(sorted, bhQByBas) {
    const status = p => {
        const q = (bhQByBas || {})[p.bas];
        const sig = p.pValue < 0.05 && (q == null || q < 0.05);
        return _PERBAS_STATUS[{ titta: 0, dokumentera: 1 }[_stsPerBasSignal(p.gapPct, sig, p.pValue < 0.05).niva] ?? 2];
    };
    const pkt = p => ({ y: 'BAS ' + p.bas, x: +p.gapPct.toFixed(2), fel: { lag: Math.min(p.ciLow, p.gapPct), hog: Math.max(p.ciHigh, p.gapPct) },
                        n: p.n, kvN: p.kvN, maN: p.maN, bas: p.bas, markering: markeringFor(p.bas) });
    const tips = d => [[d.y], ['Oförklarad skillnad', `${_figTalformat(d.x, 'tal2')} %`],
        ['95 % KI', `${_figTalformat(d.fel.lag, 'pct', { enhet: false })} – ${_figTalformat(d.fel.hog, 'pct')}`],
        ['Antal', `${d.n} (${d.kvN} kv / ${d.maN} mä)`]];
    return { beskrivning: 'Oförklarad löneskillnad per BAS-intervall med 95 % konfidensintervall. Samma siffror finns i tabellen under diagrammet.',
        // Noll ska ligga INOM axeln med luft på båda sidor, så att nollinjen syns också när alla gap har samma tecken.
        x: { skala: 'linjar', titel: 'Oförklarad skillnad (%), negativt = kvinnor lägre', nollinje: true, doman: _perBasDoman(sorted) },
        urval: URVAL.bas, y: { skala: 'band', ordning: sorted.map(p => 'BAS ' + p.bas) },
        hojd: Math.max(170, 104 + sorted.length * 30),
        lager: _PERBAS_STATUS.map(s => ({ marke: 'punkt', riktning: 'liggande', symbol: s.symbol, storlek: 6, serie: s.serie, farg: PALETTE.semantic[s.farg],
            data: sorted.filter(p => status(p) === s).map(pkt), tips }))
            .filter(l => l.data.length) };
}

// ---- Trappan: hur lönegapet förklaras steg för steg ----
// Visas bara när ALLA steg får visas. När det ojusterade steget utelämnas (ett kön under tröskeln, ADR-38 R1) ritas
// ingen trappa alls — en trappa som börjar på steg två skulle låta det utelämnade räknas fram.
function _regTrappaVisas(stegUt) {
    return !!stegUt && !stegUt.utelamnat && stegUt.steg.filter(s => s.status === 'ok').length >= 2 && stegUt.steg[0].status === 'ok';
}
const _REG_TRAPPSTEG = { '+ BAS-intervall': 'BAS-intervall', '+ Ålder': 'Ålder', '+ Yrkesgrupp': 'Yrkesgrupp inom BAS' };
/** @param {any[]} seqOk @param {any} [yrkesSteg] yrkesgruppssteget efter huvudtalet (när det inte är valt in i modellen) @param {string} [fras] */
function _regTrappaFigur(seqOk, yrkesSteg = null, fras = 'ålder och BAS-intervall') {
    const forst = seqOk[0], sist = seqOk[seqOk.length - 1];
    const yrke = yrkesSteg && yrkesSteg.status === 'ok' && typeof yrkesSteg.gapPct === 'number' ? yrkesSteg : null;
    const pct = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')} %`;
    const pp = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')} procentenheter`;
    const kategorier = ['Ojusterad skillnad', ...seqOk.slice(1).map(s => _REG_TRAPPSTEG[s.name] || s.name.replace(/^\+ /, '')), 'Oförklarad skillnad', ...(yrke ? ['Yrkesgrupp inom BAS'] : [])];
    // Varje förklaringssteg: från gapet före steget till gapet efter. Seriens blå när gapet krymper mot noll, orange när
    // det växer — inte grönt och gult: att ett gap FÖRKLARAS av ålder eller nivå är ingen bedömning av att det är bra.
    const steg = seqOk.slice(1).map((s, i) => {
        const fore = seqOk[i].gapPct, efter = s.gapPct;
        return { x: kategorier[i + 1], lag: Math.min(fore, efter), hog: Math.max(fore, efter), fore, efter, andring: efter - fore,
                 farg: Math.abs(efter) <= Math.abs(fore) ? PALETTE.serie[0] : PALETTE.serie[1] };
    });
    const niva = (x, v) => ({ x, y: +v.toFixed(2), etikett: pct(v) });
    return { beskrivning: `Hur löneskillnaden förklaras steg för steg: från den ojusterade skillnaden ${pct(forst.gapPct)} till det oförklarade ${pct(sist.gapPct)} när ${fras} räknas in.${yrke ? ` Räknas också yrkesgrupp inom BAS bort blir ${pct(yrke.gapPct)} kvar; det steget ingår inte i huvudtalet.` : ''} Negativ skillnad betyder att kvinnor har lägre lön. Samma tal står i förklaringsbudgeten.`,
        legend: false, hojd: 300,
        x: { skala: 'band', ordning: kategorier }, y: { skala: 'linjar', titel: 'Löneskillnad (%)', nollinje: true },
        lager: [
            { marke: 'stapel', lage: 'overlagrad', serie: 'Skillnad', farg: PALETTE.semantic.neutral, opacitet: 0.4,   // ljus, så att nivåns etikett går att läsa
              data: [{ x: 'Ojusterad skillnad', y: +forst.gapPct.toFixed(2) }, { x: 'Oförklarad skillnad', y: +sist.gapPct.toFixed(2) }],
              tips: d => [[d.x], ['Löneskillnad', pct(d.y)]] },
            { marke: 'intervall', serie: 'Förklaras av', tjocklek: 44, data: steg,
              tips: d => [[d.x], ['Ändrar skillnaden med', pp(d.andring)], ['Skillnad före', pct(d.fore)], ['Skillnad efter', pct(d.efter)]] },
            // Yrkesgruppssteget (ADR-46) efter huvudtalet, ljusare: det ingår inte i huvudtalet.
            ...(yrke ? [{ marke: 'intervall', serie: 'Yrkesgrupp inom BAS (ingår inte i huvudtalet)', tjocklek: 44, opacitet: 0.45,
              data: [{ x: 'Yrkesgrupp inom BAS', lag: Math.min(sist.gapPct, yrke.gapPct), hog: Math.max(sist.gapPct, yrke.gapPct), fore: sist.gapPct, efter: yrke.gapPct, andring: yrke.gapPct - sist.gapPct,
                       farg: Math.abs(yrke.gapPct) <= Math.abs(sist.gapPct) ? PALETTE.serie[0] : PALETTE.serie[1] }],
              tips: d => [[d.x], ['Ändrar skillnaden med', pp(d.andring)], ['Skillnad före', pct(d.fore)], ['Kvar efter yrkesgrupp', pct(d.efter)], ['Ingår inte i huvudtalet', '']] }] : []),
            // Nivån efter varje steg, med sitt värde: ett streck och en etikett.
            { marke: 'punkt', symbol: 'streck', serie: 'Skillnad efter steget', farg: PALETTE.semantic.mork, storlek: 11,
              data: [niva('Ojusterad skillnad', forst.gapPct), ...seqOk.slice(1).map((s, i) => niva(kategorier[i + 1], s.gapPct)), niva('Oförklarad skillnad', sist.gapPct),
                     ...(yrke ? [niva('Yrkesgrupp inom BAS', yrke.gapPct)] : [])] }
        ] };
}

// ---- Gapet längs lönefördelningen ----
// Kvantilregressionens tre skattningar (P10, median, P90): är strecket längst i toppen är gapet störst bland de
// högst betalda (glastak), längst i botten bland de lägst betalda (klibbigt golv). Samma tal som tabellen under.
/** @type {any[]|null} */
let _regKvantilSenast = null;
// Bootstrap-KI på könskoefficienten och på skillnaden P90 − P10 (ADR-63): B omsamplingar av raderna, percentilintervall, seedat ur datat (_rngFor) så
// att intervallet är detsamma varje gång. Över REG_KVANTIL_KI_MAX_N personer räknas inget intervall (tiden), och
// tabellen säger det. IRLS-skattningen (_quantileRegression) är en approximation av kvantillösningen; intervallet
// bootstrappar den approximationen, inte den exakta LP-lösningen.
const REG_KVANTIL_KI_B = 200, REG_KVANTIL_KI_MAX_N = 2000;
// Minne för senaste beräkning: kortet ritas om vid varje flikbyte, och bootstrappen är det dyra (uppmätt ~0,5 s
// på demodatat, ~11 s på 5 000 rader, därav gränsen 2 000 ≈ 4 s). Nyckeln är datats eget frö (antal och lönesummor per kön) plus ålderssumman.
/** @type {{nyckel: string, ut: any}|null} */
let _regKvantilMinne = null;
// Intervallet räknas i bakgrunden efter att kortet ritats (setTimeout), som bootstrap-KI:t vid inläsning: kortet
// står med punktskattningarna och raden "räknas i bakgrunden" tills dess, och ritas om när intervallet finns. Det
// gäller också i exportläget (ADR-51): en bild eller utskrift som görs innan intervallet är klart bär kortet utan det,
// som nyckeltalen utan bootstrap-KI strax efter en inläsning. Minnet är per underlag, så ett intervall som en gång
// räknats följer med i allt som ritas sedan. `direkt: true` tvingar en direkt beräkning (tester).
/** @type {Promise<void>|null} */
let _regKvantilBakgrund = null;
/** Löftet för den pågående bakgrundsberäkningen, eller ett uppfyllt när ingen pågår (tester väntar in det). */
function _regKvantilKlar() { return _regKvantilBakgrund || Promise.resolve(); }
/**
 * Kvantilregressionens tre skattningar (runQuantileRegressionAtAllTau) med ett percentil-bootstrap-KI per τ och för
 * skillnaden P90 − P10 (ADR-63). Designen är _rgKvantilDesign — samma byggare och samma radurval som punktskattningen
 * (huvudmodellens variabler enligt förklaringsmodellen, utan yrkesgrupp). Varje omsampling drar rader med
 * återläggning och bygger designen på nytt ur dem, så att referensintervallet är det första som finns i
 * omsamplingen och ett intervall som inte kom med inte ger en nollkolumn; könskoefficienten beror inte på
 * referensen eller centreringen.
 * @param {{direkt?: boolean}} [val]
 * @returns {null | {results: Array<{tau:number, konPct?:number, error?:boolean, ki?:{lag:number, hog:number}|null}>,
 *   diff: {varde:number|null, ki:{lag:number, hog:number}|null}, n:number, nKv:number, nMa:number, kiB:number,
 *   kiUtelamnad:string, kiVantar?: boolean, nyckel?: string}}
 */
function _regKvantilBerakna({ direkt = false } = {}) {
    const qr = runQuantileRegressionAtAllTau();
    if (!qr) return null;
    const results = qr.results.map(r => ({ ...r, ki: null }));
    const diff = { varde: qr.diffP90P10, ki: null };
    if (qr.n > REG_KVANTIL_KI_MAX_N) {
        return { results, diff, n: qr.n, nKv: qr.nKv, nMa: qr.nMa, kiB: 0, kiUtelamnad: `Konfidensintervallet räknas inte vid fler än ${svTal(REG_KVANTIL_KI_MAX_N, 0)} personer (tiden för ${REG_KVANTIL_KI_B} omsamplingar).` };
    }
    const modell = forklaringsmodell();
    const raw = _rgKvantilDesign(getData(), modell).rader;
    const arKv = d => d.kon.includes('kvinna');
    const nyckel = `${_rngSeedFrom(raw.filter(arKv).map(d => d.lon), raw.filter(d => !arKv(d)).map(d => d.lon), raw.map(d => d.alder || 0))}|${raw.length}|${qr.kolumner.join(',')}|${results.map(r => r.konPct).join(',')}`;
    if (_regKvantilMinne && _regKvantilMinne.nyckel === nyckel) return _regKvantilMinne.ut;
    const rakna = () => { const ut = _regKvantilBootstrap(raw, modell, results.map(r => ({ ...r })), arKv); _regKvantilMinne = { nyckel, ut: { ...ut, diff: { varde: diff.varde, ki: ut.diffKi }, n: qr.n, nKv: qr.nKv, nMa: qr.nMa } }; return _regKvantilMinne.ut; };
    if (direkt) return rakna();
    if (!_regKvantilBakgrund) {
        _regKvantilBakgrund = new Promise(resolve => setTimeout(() => {
            try {
                if (!(_regKvantilMinne && _regKvantilMinne.nyckel === nyckel)) rakna();
                // Kortet ritas om bara om det fortfarande visar samma underlag, och inte mitt i en export (den ritar själv).
                const kort = document.getElementById('regression-card');
                if (kort && kort.dataset.kvantilNyckel === nyckel && state.data.length && !(typeof iExportLage === 'function' && iExportLage())) renderRegressionCard();
            } catch (e) { rapporteraFel('kvantilregressionens intervall', e); }
            finally { _regKvantilBakgrund = null; resolve(); }
        }, 0));
    }
    return { results, diff, n: qr.n, nKv: qr.nKv, nMa: qr.nMa, kiB: REG_KVANTIL_KI_B, kiUtelamnad: '', kiVantar: true, nyckel };
}
function _regKvantilBootstrap(raw, modell, results, arKv) {
    const rnd = _rngFor(raw.filter(arKv).map(d => d.lon), raw.filter(d => !arKv(d)).map(d => d.lon));   // seedad ur datat → reproducerbart KI
    const n = raw.length, B = REG_KVANTIL_KI_B;
    const prov = results.map(() => []);
    const diffProv = [];
    const i10 = results.findIndex(r => r.tau === 0.1), i90 = results.findIndex(r => r.tau === 0.9);
    // Ålder centreras på hela urvalets medel (könskoefficienten beror inte på centreringen).
    const ageMean = modell.alder ? raw.reduce((s, d) => s + d.alder, 0) / n : undefined;
    // Varje omsampling startar IRLS i hela urvalets lösning (samma kolumn efter namn), vilket bara gör det snabbare.
    const hel = _rgKvantilDesign(raw, modell, { ageMean });
    const helBeta = results.map(r => (r.error ? null : (_quantileRegression(hel.X, hel.y, r.tau) || {}).beta || null));
    for (let b = 0; b < B; b++) {
        const urval = new Array(n);
        for (let i = 0; i < n; i++) urval[i] = raw[Math.floor(rnd() * n)];
        const { X, y, kolumner } = _rgKvantilDesign(urval, modell, { ageMean });
        const konPct = results.map((r, k) => {
            if (r.error) return null;
            const b0 = helBeta[k];
            const start = b0 ? kolumner.map(c => { const j = hel.kolumner.indexOf(c); return j >= 0 ? b0[j] : 0; }) : null;
            const fit = _quantileRegression(X, y, r.tau, undefined, undefined, start);
            return fit ? (Math.exp(fit.beta[1]) - 1) * 100 : null;
        });
        konPct.forEach((v, k) => { if (v != null) prov[k].push(v); });
        if (i10 >= 0 && i90 >= 0 && konPct[i10] != null && konPct[i90] != null) diffProv.push(konPct[i90] - konPct[i10]);
    }
    const intervall = v => {
        v.sort((a, c) => a - c);
        return v.length < B / 2 ? null : { lag: v[Math.floor(v.length * 0.025)], hog: v[Math.min(v.length - 1, Math.floor(v.length * 0.975))] };
    };
    results.forEach((r, k) => { if (!r.error) r.ki = intervall(prov[k]); });
    return { results, diffKi: intervall(diffProv), kiB: B, kiUtelamnad: '' };
}
// Tre skattningar är ingen trend: en rad per del av lönefördelningen, med gapet som ett streck från
// nollinjen (inget gap) till värdet — axeln börjar i noll, så avstånden går att jämföra.
function _regKvantilFigur(resultat) {
    const namn = { 0.1: 'P10 (lägst betalda)', 0.5: 'Median', 0.9: 'P90 (högst betalda)' };
    const pct = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')} %`;
    const data = resultat.map(r => ({ y: namn[r.tau] || `P${Math.round(r.tau * 100)}`, x: +r.konPct.toFixed(2),
        ...(r.ki ? { fel: { lag: +r.ki.lag.toFixed(2), hog: +r.ki.hog.toFixed(2) } } : {}) }));
    const kanter = data.flatMap(d => d.fel ? [d.x, d.fel.lag, d.fel.hog] : [d.x]);
    const lag = Math.min(0, ...kanter), hog = Math.max(0, ...kanter), luft = Math.max(0.5, (hog - lag) * 0.12);
    const medKi = data.some(d => d.fel);
    const fras = _rgModellFras({ ...forklaringsmodell(), yrkesgrupp: false });
    return { beskrivning: `Löneskillnaden i olika delar av lönefördelningen: vid P10, medianen och P90${fras ? `, efter kontroll för ${fras}` : ''}, som avstånd från nollinjen. Negativ skillnad betyder att kvinnor har lägre lön.`
            + (medKi ? ' Strecket genom punkten är ett 95-procentigt bootstrap-konfidensintervall.' : ''),
        legend: false, y: { skala: 'band', ordning: data.map(d => d.y) }, x: { skala: 'linjar', titel: 'Löneskillnad (%), negativt = kvinnor lägre', nollinje: true, doman: [lag - luft, hog + luft] },
        hojd: 200,
        lager: [{ marke: 'intervall', riktning: 'liggande', serie: 'Avstånd från noll', farg: PALETTE.serie[0], opacitet: 0.5, tjocklek: 3, data: data.map(d => ({ y: d.y, lag: Math.min(0, d.x), hog: Math.max(0, d.x) })) },
                // Liggande: punktens intervall (`fel`) ligger längs värdeaxeln x. Utan riktning lästes gränserna som
                // kategorier på bandaxeln och skrevs ut som råa tal (U4, ADR-63).
                { marke: 'punkt', riktning: 'liggande', serie: 'Löneskillnad', farg: PALETTE.serie[0], storlek: 6, etikettLage: 'vanster', data: data.map(d => ({ ...d, etikett: pct(d.x) })),
                  tips: d => [[d.y], ['Löneskillnad', pct(d.x)], ...(d.fel ? [['95 % KI (bootstrap)', `${pct(d.fel.lag)} till ${pct(d.fel.hog)}`]] : [])] }] };
}

// ---- Modellpanelen (ADR-56) ----
// Vilka variabler som räknas bort, vad var och en tillför (alltid mot fullmodellen), verktygets förslag, skälet
// utanför siffrorna och noteringen om det bortvalda. Ritas av renderRegressionCard med samma regressionsresultat.
const _FM_ETIKETT = { bas: 'BAS-intervall', alder: 'Ålder', yrkesgrupp: 'Yrkesgrupp inom BAS' };
/**
 * Formuleringarna i kortet för en vald modell (ADR-56). Standardmodellen ger dagens texter.
 * @param {{bas:boolean, alder:boolean, yrkesgrupp:boolean}} m
 */
function _fmTexter(m) {
    const fras = _rgModellFras(m);
    const lista = (delar, skilj = ' och ') => (delar.length <= 1 ? delar.join('') : `${delar.slice(0, -1).join(', ')}${skilj}${delar[delar.length - 1]}`);
    const forklarasAv = lista([...(m.alder ? ['åldersfördelning'] : []), ...(m.bas ? ['BAS-placering'] : []), ...(m.yrkesgrupp ? ['yrkesgrupp inom BAS'] : [])]);
    const samma = m.alder || m.bas ? `i ${lista([...(m.alder ? ['samma ålder'] : []), ...(m.bas ? ['samma BAS-intervall'] : []), ...(m.yrkesgrupp ? ['samma yrkesgrupp'] : [])])}` : 'oavsett ålder och BAS-intervall';
    const motiv = lista([...(m.alder ? ['att kvinnor är yngre'] : []), ...(m.bas ? ['arbetar i andra BAS-intervall'] : []), ...(m.yrkesgrupp ? ['finns i andra yrkesgrupper'] : [])], ' eller ');
    const variabler = ['kön', ...(m.alder ? ['ålder'] : []), ...(m.bas ? ['BAS-intervall'] : []), ...(m.yrkesgrupp ? ['yrkesgrupp inom BAS'] : [])];
    const antalOrd = ['', 'en sak', 'två saker', 'tre saker', 'fyra saker'][variabler.length];
    const sista = m.yrkesgrupp ? '+ Yrkesgrupp' : m.alder ? '+ Ålder' : m.bas ? '+ BAS-intervall' : 'Endast kön';
    return { fras, nar: fras ? `när ${fras} räknats bort` : 'utan att något räknats bort', forklarasAv, samma, motiv, variabler, antalOrd, sista };
}
/** Noteringen om en bortvald variabel, som den står i panelen och i rapporten (ren text). */
function _fmNoteringText(b) {
    return _ruBortvaltNotering(b).replace('ingår inte i siffrorna.', 'ingår inte i siffrorna nedan.');
}
function renderForklaringsmodellPanel(r) {
    const wrap = document.getElementById('forklaringsmodell-panel');
    if (!wrap) return;
    if (!r || r.error) { wrap.innerHTML = ''; return; }
    // Kryssrutorna visar valet; när "endast kön" spärrats (modellVarning) visas och lagras modellen som faktiskt gäller,
    // så att konfigurationsfilen inte bär ett val som inte kan användas.
    const visad = r.modellVarning ? r.modell : r.modellVald;
    if (r.modellVarning && state.forklaringsmodell && (!state.forklaringsmodell.bas && !state.forklaringsmodell.alder)) {
        const ny = { ...state.forklaringsmodell, bas: true, alder: true };
        state.forklaringsmodell = _rgForklaringsmodellArStandard(ny) ? null : ny;
    }
    const harYrke = r.tillfor.rader.some(x => x.variabel === 'yrkesgrupp');
    const fmtGap = v => (typeof v === 'number' && isFinite(v) ? `${v >= 0 ? '+' : '−'}${svPct(Math.abs(v), 1)}` : '–');
    const kryss = (v, text, pa, { disabled = false, title = '' } = {}) =>
        `<label class="fs-sm rad-mitt gap-6"><input type="checkbox" data-fm="${v}"${pa ? ' checked' : ''}${disabled ? ' disabled' : ''}${title ? ` title="${esc(title)}"` : ''}> ${esc(text)}</label>`;
    const rader = r.tillfor.rader.map(x => {
        const bedomning = x.status !== 'ok' ? 'Gick inte att pröva'
            : x.variabel === 'yrkesgrupp' ? (x.tillforLite ? 'Tillför lite (ingår inte i standard)' : 'Tillför (ingår inte i standard)')
            : x.tillforLite ? 'Tillför lite' : 'Behövs';
        return `<tr><td>${esc(_FM_ETIKETT[x.variabel])}</td>
            <td class="t-tal">${x.status === 'ok' ? `+${svTal(x.deltaR2pp, 1)} procentenheter` : '–'}</td>
            <td class="t-tal ingen-radbrytning">${x.status === 'ok' ? `${fmtGap(x.gapUtan)} till ${fmtGap(x.gapMed)}` : '–'}</td>
            <td>${esc(bedomning)}</td></tr>`;
    }).join('');
    const tabort = r.tillfor.forslag.tabort.filter(v => visad[v]);
    const forslagHtml = tabort.length
        ? `<div class="bak-ok-bg rund-6 fs-sm lh-1_55 pad-10-12 marg-t-10"><strong>Förslag:</strong> ${tabort.map(v => _FM_ETIKETT[v].toLowerCase()).join(' och ')} kan lämnas utanför. ${tabort.length === 1 ? 'Den' : 'De'} har kontrollerats och förklarar ${tabort.map(v => svTal(r.tillfor.rader.find(x => x.variabel === v).deltaR2pp, 1)).join(' respektive ')} procentenheter av lönespridningen.
            <button type="button" class="btn btn-secondary btn-sm marg-l-8" data-fm-forslag="${tabort.join(',')}">Ta bort ${tabort.map(v => _FM_ETIKETT[v].toLowerCase()).join(' och ')}</button>
            <button type="button" class="btn btn-secondary btn-sm" data-fm-behall>Behåll</button></div>`
        : `<p class="text-dampad-sm marg-t-10">${r.bortvalt.length ? 'Det som är kvar i modellen tillför.' : 'Alla variabler tillför; fullmodellen behålls.'}</p>`;
    const notering = r.bortvalt.length
        ? `<p class="text-dampad-sm lh-1_55 marg-t-8" data-fm-notering data-hjalptext>${r.bortvalt.map(b => esc(_fmNoteringText(b))).join(' ')}</p>`
        : '';
    wrap.innerHTML = `
        <div class="card" role="region" aria-label="Förklaringsmodell">
            <h3 class="marg-0-0-6">Förklaringsmodell
                <span class="info-tip" data-tooltip="Vilka skillnader mellan kvinnor och män räknas bort innan löneskillnaden mäts? Fullmodellen (BAS-intervall och ålder) är utgångsläge. Ta bort en variabel som tillför lite, så blir avsnittet enklare att läsa; den redovisas ändå som kontrollerad, också i rapporten.">${ikon('info', 14)}</span>
            </h3>
            <div class="rad-mitt gap-14 rad-bryt fs-sm">
                <span>Kön +</span>
                ${kryss('bas', 'BAS-intervall', visad.bas, visad.yrkesgrupp ? { disabled: true, title: 'Yrkesgrupp inom BAS förutsätter BAS' } : {})}
                ${kryss('alder', 'Ålder', visad.alder, harAlder() ? {} : { disabled: true, title: 'Kräver ålder i lönefilen' })}
                ${harYrke ? kryss('yrkesgrupp', 'Yrkesgrupp inom BAS', visad.yrkesgrupp) : '<span class="text-dampad-sm">Yrkesgrupp inom BAS kan inte väljas: lönefilen saknar AID och yrke.</span>'}
            </div>
            ${r.modellVarning ? `<p class="k-mask-note" role="note">${esc(r.modellVarning)}</p>` : ''}
            ${r.fellBackFromFull ? `<p class="k-mask-note" role="note">Den valda modellen kunde inte skattas (multikollinearitet); verktyget räknar på ${esc(r.modelDesc)}.</p>` : ''}
            <table class="data-table st-09 marg-t-10">
                ${antalCaption(r.nKvAnalysed, r.nMaAnalysed, 'Vad varje variabel tillför, räknat mot fullmodellen (ändras inte av valet)')}
                <thead><tr><th>Variabel</th><th class="t-hoger" title="Hur mycket förklaringsgraden (R²) ökar när variabeln läggs till sist">Tillför i förklaringsgrad</th><th class="t-hoger" title="Löneskillnaden utan variabeln, sedan med variabeln">Flyttar skillnaden</th><th>Bedömning</th></tr></thead>
                <tbody>${rader}</tbody>
            </table>
            <p class="text-dampad-xs marg-t-6">Under ${svTal(_rgTillforGransPp(), 1)} procentenheter räknas som <em>tillför lite</em>. Förslaget är ett pedagogiskt råd om vad som är värt att visa, inte ett statistiskt test.</p>
            ${forslagHtml}
            <p class="rad-mitt gap-8 marg-t-10 fs-sm"><label for="fm-skal">Skäl utanför siffrorna (valfritt)</label>
                <input type="text" id="fm-skal" class="form-select flex-1" maxlength="300" value="${esc(visad.skal || '')}" placeholder="t.ex. organisationen sätter inte lön efter ålder" autocomplete="off"></p>
            <p class="k-mask-note" id="fm-skal-not" role="note" hidden></p>
            ${notering}
        </div>`;
    wrap.onchange = e => {
        const t = /** @type {HTMLElement} */ (e.target);
        const inp = /** @type {HTMLInputElement} */ (t);
        const nu = forklaringsmodell();
        if (t.matches('input[data-fm]')) {
            const v = String(t.dataset.fm);
            const ny = { ...nu, [v]: inp.checked };
            if (v === 'yrkesgrupp' && inp.checked) ny.bas = true;
            if (v === 'bas' && !inp.checked) ny.yrkesgrupp = false;
            sattForklaringsmodell(ny);
        } else if (t.id === 'fm-skal') {
            const not = document.getElementById('fm-skal-not');
            if (_opLiknarPersonuppgift(inp.value)) {
                inp.value = nu.skal || '';
                if (not) { not.textContent = 'Skälet ser ut att innehålla en personuppgift (personnummer eller e-post) och sparas inte. Skriv på gruppnivå.'; not.hidden = false; }
                return;
            }
            if (not) not.hidden = true;
            sattForklaringsmodell({ ...nu, skal: inp.value.trim() }, { rita: false });
            renderForklaringsmodellPanel(runOLSRegression());   // noteringen bär skälet; inga tal ändras
        }
    };
    wrap.onclick = e => {
        const t = /** @type {HTMLElement} */ (e.target).closest('[data-fm-forslag], [data-fm-behall]');
        if (!t) return;
        const nu = forklaringsmodell();
        if (t.hasAttribute('data-fm-behall')) { sattForklaringsmodell(nu); return; }
        const ny = { ...nu };
        String(t.getAttribute('data-fm-forslag')).split(',').forEach(v => { if (v) ny[v] = false; });
        if (!ny.bas) ny.yrkesgrupp = false;
        sattForklaringsmodell(ny);
    };
}

function renderRegressionCard() {
    const wrap = document.getElementById('regression-card');
    if (!wrap) return;
    const r = runOLSRegression();
    renderForklaringsmodellPanel(r);
    const fmT = _fmTexter(r.error ? _rgNormaliseraForklaringsmodell(null).modell : r.modell);
    const fmRubrik = document.querySelector('[data-fm-rubrik]'), fmInledning = document.querySelector('[data-fm-inledning]');
    if (fmRubrik) fmRubrik.textContent = fmT.fras ? `När ${fmT.fras} räknats bort, steg för steg` : 'Den råa skillnaden, utan att något räknats bort';
    if (fmInledning && !r.error) fmInledning.innerHTML = fmT.fras
        ? (fmT.fras === 'ålder och BAS-intervall' ? 'Här räknar verktyget bort att kvinnor och män har olika ålder och arbetar i olika BAS-intervall. Det som blir kvar kan <em>inte</em> förklaras av de faktorerna.' : `Här räknar verktyget bort att kvinnor och män skiljer sig i ${esc(fmT.forklarasAv)}. Det som blir kvar kan <em>inte</em> förklaras av ${fmT.variabler.length > 2 ? 'de faktorerna' : 'den faktorn'}.`)
        : 'Här visas den råa skillnaden: ingen variabel räknas bort (valet i panelen nedan).';

    // ----- Felfall: kunde inte estimeras alls -----
    if (r.error) {
        const tried = (r.triedSteps || []).map(s => {
            const sym = s.status === 'ok' ? ikon('bock', 14) : ikon('kryss', 14);
            const note = s.status === 'singular' ? 'multikollinearitet' : s.status === 'too_few' ? `för få obs (k=${s.k})` : '';
            return `<li><span class="typsnitt-mono">${sym}</span> <code>${esc(s.desc || s.name)}</code> <span class="text-dampad-sm">${note}</span></li>`;
        }).join('');
        const diag = (r.diagnostics || []).map(d => `<li>${d}</li>`).join('');
        wrap.innerHTML = `
            <div class="card ram-v-4-danger" role="region" aria-label="Regressionsanalys misslyckades">
                <h3 class="marg-0-0-8">Regressionen kunde inte genomföras</h3>
                <p class="marg-0-0-12">${esc(r.error)}</p>
                ${tried ? `<div class="mt-14"><div class="text-dampad-xs versal fw-600 marg-b-6">Försökta modellspecifikationer</div><ul class="lh-1_8 utan-punkter marg-0 pad-0">${tried}</ul></div>` : ''}
                ${diag ? `<div class="bak-varning-bg-gammal ram-v-3-danger rund-4 marg-t-14 pad-12-14"><strong>Identifierade orsaker:</strong><ul class="lh-1_6 marg-6-0-0-18">${diag}</ul></div>` : ''}
                <p class="text-dampad-sm marg-t-14">Tips: komplettera med fler observationer per yrkesgrupp.</p>
            </div>
        `;
        return r;
    }

    // ----- Lyckad estimering -----
    const sig    = _formatPValue(r.pValue);
    const isSig  = r.pValue < 0.05;
    const sign   = r.konPct >= 0 ? '+' : '';

    // Verdikt – plain language slutsats
    let verdict;
    if (!isSig) {
        verdict = { cls:'ok',   icon: ikon('bock', 28), title:'Ingen kvarstående skillnad',
                    sub:`${fmT.nar.charAt(0).toUpperCase()}${fmT.nar.slice(1)} finns ingen skillnad som går att säkerställa. Det betyder inte att allt är perfekt — men underlaget ger inget stöd för en generell skillnad.` };
    } else if (Math.abs(r.konPct) >= _STS_STORLEK) {
        verdict = { cls:'crit', icon:ikon('nal', 28),  title:'Här bör du titta närmare',
                    sub:`Skillnaden är statistiskt säkerställd, minst 3 procent (verktygets storleksgräns) och ${fmT.fras ? `finns kvar även ${fmT.nar}` : 'står utan att något räknats bort'}. Gå igenom grupperna nedan, väg varje skillnad mot sakliga skäl och ta upp frågan med facket.` };
    } else {
        verdict = { cls:'warn', icon:ikon('oga', 28),  title:'Skriv ner varför',
                    sub:'Det finns en skillnad som inte är slump, men den är mindre än 3 procent (verktygets storleksgräns). Dokumentera vad den beror på så att du kan visa det vid nästa kartläggning.' };
    }
    const verdictFarg = verdict.cls === 'crit' ? 'kritisk' : verdict.cls === 'warn' ? 'varning' : 'ok';

    // Modell-banner (om fallback)
    const modelBanner = r.fellBackFromFull
        ? `<div class="bak-varning-bg ram-v-3-varning rund-4 fs-sm marg-b-12 pad-10-14">
              <strong>Notering:</strong> Fullmodellen kunde inte estimeras (multikollinearitet). Föll tillbaka till <code>${esc(r.modelDesc)}</code>.
              ${r.diagnostics.length ? `<details class="marg-t-6" open><summary class="pekare">Visa orsak</summary><ul class="lh-1_6 marg-6-0-0-18">${r.diagnostics.map(d => `<li>${d}</li>`).join('')}</ul></details>` : ''}
           </div>`
        : '';

    // Bidragsuppdelning (visuell waterfall) — visar hur gapet krymper när kontroller läggs till
    // Första steget ("Endast kön") och det som räknas ur det följer tröskeln (ADR-12); se _regStegForRedovisning.
    const stegUt = _regStegForRedovisning(r);
    // Trappan, budgetens "kvarstår" och ansvarsraden utgår från modellens steg (huvudtalet, ADR-56); yrkesgruppssteget
    // ingår när yrkesgrupp är vald och läggs annars till där det visas (ADR-46).
    const seqOk = stegUt.steg.filter(s => s.status === 'ok' && (r.modell.yrkesgrupp || s.name !== '+ Yrkesgrupp'));
    const stepDescription = {
        'Endast kön':       'Endast kön (utan strukturell kontroll)',
        '+ BAS-intervall':  r.modell.alder ? 'Efter kontroll för BAS-intervall' : 'Efter kontroll för BAS-intervall (full modell)',
        '+ Ålder':          r.modell.bas ? 'Efter kontroll för BAS-intervall och ålder (full modell)' : 'Efter kontroll för ålder (full modell)',
        '+ Yrkesgrupp':     r.modell.yrkesgrupp ? 'Efter kontroll även för yrkesgrupp inom BAS (full modell)' : 'Efter kontroll även för yrkesgrupp inom BAS'
    };
    // Övergången: "rensar bort" i första steget efter det ojusterade, "rensar dessutom bort" därefter.
    const stepTransitionText = (name, forsta) => ({
        '+ BAS-intervall':  `rensar ${forsta ? '' : 'dessutom '}bort effekten av att kvinnor och män är olika fördelade över BAS-intervallen`,
        '+ Ålder':          `rensar ${forsta ? '' : 'dessutom '}bort effekten av att kvinnor och män har olika åldersfördelning`,
        '+ Yrkesgrupp':     `rensar ${forsta ? '' : 'dessutom '}bort löneskillnader mellan yrkesgrupper inom samma BAS-intervall`
    })[name];
    let waterfallHtml = '';
    // Staplarnas bredd räknas mot de steg som visas: annars kunde ett utelämnat steg räknas fram ur bredden.
    // Yrkesgruppssteget (ADR-46) ritas efter huvudtalet, som en rad till, när det inte är valt in i modellen.
    const yrkeVisas = r.yrkesSteg?.status === 'ok' && !r.modell.yrkesgrupp && seqOk.some(s => s.name === fmT.sista);
    const stegIKortet = yrkeVisas ? [...seqOk, r.yrkesSteg] : seqOk;
    if (seqOk.length >= (stegUt.utelamnat ? 1 : 2)) {
        const maxAbs = Math.max(...stegIKortet.map(s => Math.abs(s.gapPct)), 0.01);
        stegIKortet.forEach((s, idx) => {
            const isLast = idx === seqOk.length - 1;
            const isYrke = s.name === '+ Yrkesgrupp';
            const desc = stepDescription[s.name] || s.name;
            const trans = stepTransitionText(s.name, idx === 1);
            const widthPct = (Math.abs(s.gapPct) / maxAbs) * 100;
            const sgnW = s.gapPct >= 0 ? '+' : '−';
            const absVal = svTal(Math.abs(s.gapPct), 2);
            const stepClass = isLast ? `step-final ${verdict.cls}` : isYrke ? 'step-intermediate step-yrke' : 'step-intermediate';
            if (idx > 0 && trans) {
                waterfallHtml += `<div class="reg-waterfall-arrow">${ikon('pilNed', 14)} ${esc(trans)}</div>`;
            }
            waterfallHtml += `
                <div class="reg-waterfall-step ${stepClass}">
                    <div class="step-name">${esc(desc)}${isLast ? ' <strong>kvarstår oförklarat</strong>' : ''}</div>
                    <div class="step-bar-row">
                        <div class="step-bar-bg"><div class="step-bar-fill" data-stil-bredd="${widthPct.toFixed(1)}%"></div></div>
                        <div class="step-value">${sgnW}${absVal}%</div>
                    </div>
                    ${isYrke ? `<p class="step-note">${_yrkesStegText(s, r.modell)}</p>` : ''}
                </div>
            `;
        });
    }
    // Slutsatsen räknar till och med + Ålder (huvudtalet). Har budgeten ett yrkesgruppssteg sägs också vad som blir
    // kvar med det inräknat — annars står två olika "kvarstår" i samma block (30 % här, 15 % i budgeten).
    const explainedRowHtml = budget => stegUt.explainedShare !== null
        ? `<div class="bak-info-bg ram-v-3-info rund-4 fs-sm lh-1_55 marg-t-10 pad-10-14">
            <strong>Slutsats:</strong> ${esc(fmT.forklarasAv)} förklarar ${svPct(stegUt.explainedShare, 0)} av den råa löneskillnaden; <strong>${svPct((100-stegUt.explainedShare), 0)}</strong> blir kvar som huvudtalets oförklarade skillnad.${budget && !r.modell.yrkesgrupp && budget.parts.some(p => p.key === 'yrke') ? ` Räknas också yrkesgrupp inom BAS bort blir ${svPct(budget.remainingShare, 0)} kvar (steget + Yrkesgrupp, som inte ingår i huvudtalet).` : ''} Det oförklarade är det som <em>inte</em> kan tillskrivas ${fmT.variabler.length > 2 ? 'dessa faktorer' : 'den faktorn'} och som lönekartläggningen ska granska närmare.
           </div>`
        : '';

    // ---- Pedagogik: kronor, konkret exempel, stående reservation, budget ----
    const krFmt = v => Math.round(v).toLocaleString('sv-SE') + ' kr';
    // Kronexemplet utgår från männens medianlön — ett könsuppdelat mått som följer tröskeln (ADR-12),
    // även när regressionen själv får köras (fast golv, ADR-38).
    const konOk = _konFarRedovisas(r.nKvAnalysed, r.nMaAnalysed);
    const kr = konOk ? _regressionKronor(r) : null;
    // Summan per år som andel av kvinnornas samlade årslön i underlaget: det tal en ekonom frågar efter.
    const lonesummaKvAr = konOk ? getData().filter(d => d.lon > 0 && (!harAlder() || d.alder > 0) && typeof d.kon === 'string' && d.kon.includes('kvinna')).reduce((s, d) => s + d.lon, 0) * 12 : 0;
    const andelAvLonesumma = kr && lonesummaKvAr > 0 ? Math.abs(kr.krTotalYear) / lonesummaKvAr * 100 : null;
    // Budgeten utgår från första steget och visar skillnaderna mellan stegen: utelämnas med det.
    const budget = stegUt.utelamnat ? null : _explanationBudget(yrkeVisas ? stegIKortet : seqOk);

    // Stående reservation. Den farligaste feltolkningen av "oförklarat" är att
    // läsa det som "osakligt"/diskriminering — därför står den intill siffran,
    // inte bara i ordlistan.
    const caveatInline = `
        <p class="reg-caveat-inline" role="note"><strong>Kom ihåg:</strong> <em>oförklarat</em> betyder att skillnaden
        ${fmT.fras ? `inte fångas upp av ${esc(fmT.forklarasAv)}` : 'här är hela skillnaden, utan att något räknats bort'} — <strong>inte</strong> att den beror på kön eller är osaklig.
        Det är en signal om var du bör titta närmare, inte ett bevis.</p>`;

    // Så fungerar regressionen: tre steg i vardagsspråk, vad som räknas bort och inte, och vilket tal som används
    // till vad. Hjälptext (data-hjalptext), så att vakttestet för fackuttryck inte läser den som gränssnitt.
    const harAnsvar = r.ansvarSteg?.status === 'ok';
    const saFunkarHtml = `
        <details class="reg-sa-funkar marg-b-12" data-hjalptext open>
            <summary class="pekare fw-600 pad-8-0 ej-markerbar">Så fungerar regressionen — i tre steg</summary>
            <div class="bak-yta rund-6 fs-sm lh-1_6 marg-t-8 pad-14-16">
                <ol class="marg-0-0-10-22 pad-0">
                    <li><strong>Lönen räknas i procent, inte i kronor.</strong> Modellen arbetar med logaritmen av månadslönen, så att en skillnad betyder samma sak i BAS A som i BAS E: fem procent är fem procent.</li>
                    <li><strong>Varje person jämförs med dem som liknar personen.</strong> Modellen söker den lönenivå som bäst beskriver alla ${svTal(r.n, 0)} personer utifrån ${fmT.antalOrd} på en gång: ${esc(fmT.variabler.join(', ').replace(/, ([^,]*)$/, ' och $1'))}. Den svarar på frågan: hur mycket skiljer lönen mellan en kvinna och en man <em>${esc(fmT.samma)}</em>?</li>
                    <li><strong>Svaret är ett tal med ett spann.</strong> Huvudtalet (${sign}${svPct(r.konPct, 1)}) är den skillnaden i genomsnitt över hela underlaget. Spannet säger hur säker skattningen är, och p-värdet om skillnaden går att skilja från slumpen.</li>
                </ol>
                <p class="marg-0-0-6"><strong>Räknas bort:</strong> ${fmT.fras ? esc(fmT.variabler.slice(1).join(', ').replace(/, ([^,]*)$/, ' och $1')) : 'ingenting'}${r.yrkesSteg?.status === 'ok' && !r.modell.yrkesgrupp ? ', och yrkesgrupp inom BAS i ett eget steg nedan' : ''}. <strong>Räknas inte bort:</strong> ${r.bortvalt.map(b => `${b.etikett.toLowerCase()} (kontrollerad och vald bort i panelen ovan), `).join('')}${harAnsvar ? 'ansvar (står på en egen rad), ' : ''}anställningstid, utbildning, deltid, prestation och marknadsläge — sådant som kan vara sakliga skäl men som lönefilen inte innehåller.</p>
                <p class="marg-0-0-6"><strong>Så läser du kortet:</strong> huvudtalet överst är det som går in i rapporten. <em>Steg för steg</em> ${fmT.fras ? `visar vad ${esc(fmT.fras)} förklarar` : 'visar den ojusterade skillnaden'}, <em>per BAS-intervall</em> var skillnaden finns, och <em>lönefördelningen</em> om den är störst bland lågt eller högt betalda. Ordlistan förklarar begreppen.</p>
                <p class="marg-0-0-6">${esc(ALDER_METODVAL_TEXT)}${harAlder() ? '' : ' ' + esc(ALDER_SAKNAS_TEXT)}</p>
                <p class="marg-0 text-dampad-sm"><strong>Två råa skillnader:</strong> rutan överst räknar på medianlönen, som direktivmarkeringen (≥ 5 %) gör. Trappan räknar på medellönen i modellens skala (genomsnitt av logaritmerad lön). Talen skiljer sig något när lönefördelningen är skev. Båda är riktiga: medianen för markeringen, modellens tal för uppdelningen.</p>
            </div>
        </details>`;

    const kronorHtml = !konOk ? `<p class="k-mask-note">Skillnaden räknas inte om till kronor: exemplet utgår från männens medianlön, och ett av könen har färre än ${kTroskel()} ${personOrd(kTroskel())} i modellen.</p>` : kr ? `
        <div class="reg-kronor" role="region" aria-label="Löneskillnaden uttryckt i kronor">
            <div class="reg-kronor-head">Vad betyder ${svPct(Math.abs(r.konPct), 1)} i kronor?
                ${isSig && kr.krMonth < 0 ? '<span class="farg-dampad fw-400">(här ligger kvinnorna över männen)</span>' : ''}</div>
            ${isSig ? `
            <div class="reg-kronor-grid">
                <div class="rk-tile"><div class="rk-val">${krFmt(Math.abs(kr.krMonth))}</div><div class="rk-lbl">per kvinna och månad</div></div>
                <div class="rk-tile"><div class="rk-val">${krFmt(Math.abs(kr.krYear))}</div><div class="rk-lbl">per kvinna och år</div></div>
                <div class="rk-tile"><div class="rk-val">${krFmt(Math.abs(kr.krTotalYear))}</div><div class="rk-lbl">för alla ${r.nKvAnalysed} kvinnor i underlaget, per år${andelAvLonesumma != null ? ` (${svPct(andelAvLonesumma, 1)} av kvinnornas samlade årslön)` : ''}</div></div>
            </div>
            <p class="rk-example"><strong>Konkret:</strong> en man med medianlön tjänar <strong>${krFmt(kr.refMan)}</strong>/mån.
            En kvinna <em>${esc(fmT.samma)}</em> förutsägs enligt modellen tjäna
            <strong>${krFmt(kr.refKvinna)}</strong>/mån — alltså <strong>${krFmt(Math.abs(kr.krMonth))}</strong>
            ${kr.krMonth >= 0 ? 'mindre' : 'mer'} i månaden.</p>
            <p class="rk-caveat">Räknat med medianlönen som referens. Detta är en <strong>storleksordning</strong> för att göra
            procenttalet begripligt — inte en åtgärdskostnad. Faktisk kostnad räknas mot individlöner i fliken <em>Löneöversyn</em>.</p>
            ` : `
            <p class="rk-example">Skillnaden är <strong>inte statistiskt säkerställd</strong>. En kronsiffra skulle vara
            missvisande här: den observerade skillnaden är förenlig med slumpmässig variation.</p>`}
        </div>` : '';

    // Ansvaret (ansvarskod) redovisas på en egen rad under budgeten, inte i den: budgetens
    // "kvarstår" är huvudtalet, som inte räknar bort ansvaret (ADR-33).
    let ansvarHtml = '';
    const sistaSteg = seqOk[seqOk.length - 1];
    if (r.ansvarSteg?.status === 'ok' && sistaSteg?.name === fmT.sista) {
        ansvarHtml = `<p class="reg-ansvar">${_ansvarRadText(sistaSteg.gapPct, r.ansvarSteg.gapPct)}
            Ansvar är ett tänkbart sakligt skäl. Om det är det avgör du. Huvudtalet ovan räknar inte bort ansvaret.</p>`;
    }

    let budgetHtml = '';
    if (budget) {
        const segs = budget.parts
            .filter(p => p.share > 0.05)
            .map(p => `<div class="rb-seg rb-${p.key}" data-stil-bredd="${p.share.toFixed(1)}%" title="${esc(p.label)}: ${svTal(p.val, 2)} procentenheter"></div>`)
            .join('');
        const legend = budget.parts.map(p => `
            <li><span class="rb-key rb-${p.key}"></span>${esc(p.label)}:
                <strong>${p.val < 0 ? '−' : ''}${svTal(Math.abs(p.val), 2)} procentenheter</strong>
                <span class="f-dampad">(${svPct((Math.max(0, p.val) / budget.denom * 100), 0)} av skillnaden)</span></li>`).join('');
        budgetHtml = `
            <div class="reg-budget">
                <div class="reg-budget-title">Av den ursprungliga skillnaden på <strong>${svTal(budget.g0, 2)} procentenheter</strong> —
                    vad "åt upp" varje förklaring?</div>
                <div class="reg-budget-bar" role="img" aria-label="Staplad fördelning: hur stor del av löneskillnaden som förklaras av BAS-placering, ålder och yrkesgrupp inom BAS, och hur mycket som kvarstår. Samma siffror står i listan under.">
                    ${segs}<div class="rb-seg rb-kvar" data-stil-bredd="${budget.remainingShare.toFixed(1)}%" title="Kvarstår oförklarat"></div>
                </div>
                <ul class="reg-budget-legend">
                    ${legend}
                    <li><span class="rb-key rb-kvar"></span><strong>Kvarstår oförklarat: ${svTal(budget.remaining, 2)} procentenheter</strong>
                        <span class="f-dampad">(${svPct(budget.remainingShare, 0)} av skillnaden)</span></li>
                </ul>
                ${!r.modell.yrkesgrupp && budget.parts.some(p => p.key === 'yrke') ? `<p class="rb-note">Yrkesgrupp inom BAS räknas in i budgeten, inte i huvudtalet ovan: det som kvarstår här är skillnaden mellan kvinnor och män med samma yrkesgrupp, BAS-intervall och ålder.</p>` : ''}
                ${_budgetOrdningNot(budget)}
                ${budget.anyNegative ? `<p class="rb-note">${ikon('statusVarning')} En kontrollvariabel <em>ökade</em> skillnaden i stället för att förklara den.
                    Det betyder att den strukturella faktorn <strong>dolde</strong> en del av skillnaden — utan den kontrollen
                    såg läget bättre ut än det är.</p>` : ''}
            </div>`;
    }

    // Per-BAS conditional gap-tabell
    // Multipel jämförelse-korrigering (Benjamini-Hochberg FDR)
    // Vid 20+ per-BAS-tester förväntas ~1 falskt positivt per α=0.05-batch
    // av ren slump. BH-FDR skyddar mot detta utan att vara så strikt som
    // Bonferroni. Logik:
    //   1. Samla alla p-värden från OK-tester
    //   2. Sortera stigande
    //   3. q[i] = min(1, p[i] * m / rank)
    //   4. Tvinga monotonicitet bakifrån: q[i] = min(q[i], q[i+1], ...)
    const okTests = (r.perBas || []).filter(p => p.status === 'ok' && isFinite(p.pValue));
    const bhQByBas = {};
    if (okTests.length > 1) {
        const sorted = [...okTests].sort((a, b) => a.pValue - b.pValue);
        const m = sorted.length;
        // Steg 1: rå BH-justering
        const qRaw = sorted.map((t, i) => Math.min(1, t.pValue * m / (i + 1)));
        // Steg 2: tvinga monotonicitet (q ska inte minska med stigande rank)
        for (let i = m - 2; i >= 0; i--) {
            qRaw[i] = Math.min(qRaw[i], qRaw[i + 1]);
        }
        sorted.forEach((t, i) => { bhQByBas[t.bas] = qRaw[i]; });
    }

    // Bevis-knapp per BAS-rad. Bevis-payload
    // beräknas vid klick (inte i förväg) för att minska minne — pekar bara
    // på bas-namnet och slår upp i r.perBas + bhQByBas vid behov.
    const allM = (r.perBas || []).filter(p => p.status === 'ok' && isFinite(p.pValue)).length;
    const perBasRows = (r.perBas || []).map(p => {
        if (p.status !== 'ok') {
            const note = p.status === 'too_few' ? `För få: ${p.kvN} kvinnor, ${p.maN} män (kräver minst ${statGolv()} av varje kön)` : 'Singulär';
            return `<tr><td>${esc(p.bas)}</td><td class="t-hoger">${p.n}</td><td class="t-mitt">${p.kvN}/${p.maN}</td>`
                + `<td class="farg-dampad kursiv">${note}</td>`
                + `<td class="t-mitt f-dampad">Går ej att bedöma</td>`
                + `<td class="col-stat t-mitt f-dampad">—</td>`
                + `<td class="col-stat t-mitt f-dampad">—</td>`
                + `<td class="t-mitt"><button class="btn-evidence" data-bas-evidence="${esc(p.bas)}" type="button" title="Visa varför denna BAS inte kunde analyseras" aria-label="Visa bevis för BAS ${esc(p.bas)}">${ikon('sok')}</button></td></tr>`;
        }
        const sgn = p.gapPct >= 0 ? '+' : '';
        const q = bhQByBas[p.bas];  // undefined om bara 1 test → ingen korrigering
        // Flagga: kräver att BÅDE rå p OCH justerat q < 0.05. Skyddar mot falska positiv. Storleken prövas mot
        // statusens storleksgräns 3 % (ADR-59, src/lib/status.js); regressionens tal bär ingen direktivmarkering.
        const sigAfterCorrection = p.pValue < 0.05 && (q == null || q < 0.05);
        const sigNiva = _stsPerBasSignal(p.gapPct, sigAfterCorrection, p.pValue < 0.05).niva;
        const flag = sigNiva === 'titta' ? ikon('nal')
                   : sigNiva === 'dokumentera' ? ikon('oga')
                   : sigNiva === 'osakert' && q >= 0.05 ? ikon('statusVarning') + ' <span class="text-dampad-xs">(ej efter korr.)</span>'
                   : '';
        const cellKlass = sigNiva === 'titta' ? ' farg-granska fet' : '';
        const qCell = q != null ? _formatPValue(q) : '<span class="f-dampad">—</span>';
        // Klarspråkssignal — samma logik som flaggorna, men i ord i stället för p/q.
        const signal = sigNiva === 'titta'
                ? { txt: ikon('statusKritisk') + ' Titta närmare', title: 'Statistiskt säkerställd även efter korrigering och minst 3 % (verktygets storleksgräns). Pröva om skillnaden har sakliga skäl.' }
            : sigNiva === 'dokumentera'
                ? { txt: ikon('statusVarning') + ' Dokumentera',  title: 'Statistiskt säkerställd efter korrigering, men under 3 % (verktygets storleksgräns). Dokumentera sakliga skäl och följ upp.' }
            : sigNiva === 'osakert'
                ? { txt: ikon('statusOsaker') + ' Osäkert utslag', title: 'Ser signifikant ut i råa p-värdet men håller inte efter korrigering för multipel jämförelse. Presentera inte som säkerställt.' }
                : { txt: ikon('statusIngen') + ' Inget utslag',  title: 'Ingen statistiskt säkerställd oförklarad skillnad i detta BAS-intervall.' };
        return `<tr><td>${esc(p.bas)}</td><td class="t-hoger">${p.n}</td><td class="t-mitt">${p.kvN}/${p.maN}</td>`
            + `<td class="t-tal${cellKlass}" data-sort-value="${p.gapPct}">${sgn}${svPct(p.gapPct, 1)}</td>`
            + `<td class="ta-mitt ingen-radbrytning" title="${esc(signal.title)}">${signal.txt}</td>`
            + `<td class="col-stat tabelltal ta-mitt">${_formatPValue(p.pValue)}</td>`
            + `<td class="col-stat tabelltal ta-mitt">${qCell} ${flag}</td>`
            + `<td class="t-mitt"><button class="btn-evidence" data-bas-evidence="${esc(p.bas)}" type="button" title="Visa beräkningen bakom denna BAS-rad" aria-label="Visa bevis för BAS ${esc(p.bas)}">${ikon('sok')}</button></td></tr>`;
    }).join('');

    // Försökta steg (för teknisk spec)
    const triedRow = r.triedSteps.map(s => {
        const sym = s.status === 'ok' ? `<span class="farg-ok">${ikon('bock', 14)}</span>` : `<span class="f-dampad">${ikon('kryss', 14)}</span>`;
        const note = s.status === 'singular' ? ' (multikollinearitet)' : s.status === 'too_few' ? ' (för få obs)' : '';
        return `${sym} <code class="fs-xs">${esc(s.desc)}</code><span class="text-dampad-xs">${note}</span>`;
    }).join(' &nbsp;|&nbsp; ');

    // Tolkning – plain language sammanfattning
    // #10 Lägg till bootstrap-CI på det råa lönegapet där det nämns
    const rawCIsuffix = state.bootstrapCI ? fmtCI(state.bootstrapCI.gapPct) : '';
    const tolkning = isSig
        ? (Math.abs(r.konPct) >= _STS_STORLEK
            ? `Enligt modellen tjänar kvinnor <strong class="f-kritisk">${svPct(Math.abs(r.konPct), 1)} mindre</strong> än män ${fmT.fras ? `${esc(fmT.samma)}, alltså även efter att skillnader i ${esc(fmT.forklarasAv)} räknats bort. Detta är <em>oförklarad</em> löneskillnad — den kan <strong>inte</strong> motiveras med ${esc(fmT.motiv)}.` : 'utan att något räknats bort: det är hela skillnaden, inte en oförklarad del av den.'} Skillnaden är statistiskt säkerställd och minst 3 % (verktygets storleksgräns). Pröva om den har sakliga skäl.`
            : `Det finns en statistiskt säkerställd oförklarad löneskillnad på ${svPct(Math.abs(r.konPct), 1)}, men den är under verktygets storleksgräns på 3 %. Lagen kräver att du analyserar också den: dokumentera de sakliga skälen och följ upp den över tid.`)
        : `<strong>Den råa löneskillnaden (${_raGapText(r, v => svPct(v, 1) + rawCIsuffix)})</strong> ${fmT.fras ? `försvinner när verktyget räknar bort att kvinnor och män skiljer sig i ${esc(fmT.forklarasAv)}` : 'är statistiskt obetydligt redan utan kontroller'}. Återstående skillnad (${sign}${svPct(r.konPct, 1)}) är statistiskt obetydlig: underlaget är förenligt med att ingen verklig oförklarad skillnad finns.`;

    // #5 Statistisk transparens: flagga när underlaget gör skattningen
    // osäker — så HR inte övertolkar ett punktvärde som bygger på tunt data.
    // Tröskelvärdena är vedertagna tumregler (ej lagstadgade): n<50 = litet
    // urval; <15 obs/parameter = överanpassningsrisk; KI-bredd >10 p.e. =
    // instabil punktskattning; <10 av ena könet = svag könskontrast.
    const _obsPerParam = r.n / Math.max(1, r.k);
    const _ciWidth = (r.konPctHigh != null && r.konPctLow != null) ? (r.konPctHigh - r.konPctLow) : null;
    const _minKon = Math.min(r.nKvAnalysed, r.nMaAnalysed);
    const _relFlags = [];
    if (r.n < 50)
        _relFlags.push(`<strong>Litet urval (n=${r.n}).</strong> Skattningen har låg statistisk styrka — även en reell skillnad kan bli "ej signifikant", och punktvärdet svänger lätt med enstaka individer.`);
    if (_obsPerParam < 15)
        _relFlags.push(`<strong>Få observationer per modellparameter (${svTal(_obsPerParam, 0)} st på ${r.k} parametrar).</strong> Med många BAS-intervall relativt urvalet blir koefficienterna instabila (överanpassningsrisk). Överväg att slå ihop sällan förekommande BAS eller analysera en delmängd.`);
    if (_ciWidth != null && _ciWidth > 10)
        _relFlags.push(`<strong>Brett konfidensintervall (${svTal(r.konPctLow, 1)}–${svPct(r.konPctHigh, 1)}, bredd ${svTal(_ciWidth, 1)} p.e.).</strong> Den verkliga oförklarade skillnaden kan ligga var som helst i ett brett spann. Låt inte punktvärdet ensamt avgöra en åtgärd.`);
    if (_minKon < 10)
        _relFlags.push(`<strong>Svag könskontrast (${r.nKvAnalysed} kvinnor / ${r.nMaAnalysed} män i modellen).</strong> När det ena könet är fåtaligt blir kön-koefficienten känslig för enskilda löner.`);
    const reliabilityHtml = _relFlags.length ? `
        <div class="notis-varning fs-sm lh-1_55 marg-b-12 pad-10-14" role="note">
            <strong>Tolka resultatet med försiktighet — underlaget är begränsat</strong>
            <ul class="marg-6-0-0-18 pad-0">${_relFlags.map(f => `<li class="marg-b-4">${f}</li>`).join('')}</ul>
            <p class="farg-dampad marg-8-0-0">Resultatet kan fortfarande användas som underlag, men väg in osäkerheten i bedömningen och komplettera med den deskriptiva per-BAS-analysen och en kvalitativ granskning av sakliga skäl.</p>
        </div>` : '';

    wrap.innerHTML = `
        <div class="card bl4-${verdictFarg}" role="region" aria-label="Multivariat regressionsresultat">
            <div class="reg-intro">
                <p><span class="info-tip" data-tooltip="En statistisk metod (OLS-regression) som &quot;rensar bort&quot; effekten av att kvinnor och män har olika ålder och arbetar i olika BAS-intervall. Det som kvarstår är den OFÖRKLARADE löneskillnaden — det som inte kan tillskrivas dessa strukturella skillnader. Medlingsinstitutet använder samma slags metod för den oförklarade löneskillnaden i hela ekonomin.">${ikon('info', 14)}</span> Den <strong>råa löneskillnaden</strong> mellan kvinnor och män kan delvis förklaras av att grupperna har olika åldersstruktur och är olika fördelade över BAS-intervallen. Verktyget använder en statistisk metod som räknar bort de strukturella skillnaderna. Det som <strong>kvarstår</strong> är den <em>oförklarade</em> löneskillnaden — den del som inte beror på att kvinnor är yngre, jobbar i annat BAS osv.</p>
            </div>

            ${saFunkarHtml}
            ${modelBanner}
            ${reliabilityHtml}

            <div class="reg-hero">
                <div>
                    <div class="hero-label">Oförklarad löneskillnad, kvinnor mot män</div>
                    <div class="hero-number fg-${verdictFarg}" aria-live="polite">${sign}${svPct(r.konPct, 1)}</div>
                    <div class="hero-meta">
                        <strong>Troligt spann (95 % konfidensintervall):</strong> ${svPct(r.konPctLow, 1)} till ${svPct(r.konPctHigh, 1)}
                        <span class="info-tip" data-tooltip="95 % konfidensintervall (robusta standardfel, HC3). Intervallet visar hur säker skattningen är: upprepade man undersökningen många gånger skulle 95 % av intervallen innehålla det sanna värdet. Smalt intervall = säker skattning, brett = osäker. Klassiskt intervall för jämförelse: ${svPct(r.konPctLowClassical, 1)} till ${svPct(r.konPctHighClassical, 1)}.">${ikon('info', 14)}</span><br>
                        <strong>Statistiskt säkerställd:</strong>
                        <span title="${esc(_sigPlainText(r.pValue))}" class="ram-b-1-prickad-dampad hjalpmarke hjalp-markor">${isSig ? 'Ja' : 'Nej'} (${sig})</span><br>
                        <span class="reg-hero-kvot">Samma sak som att kvinnors lön är ${svPct(r.konKvot, 1)} av mäns ${esc(fmT.nar)} — talet i nyckeltalsraden överst i fliken.</span>
                    </div>
                </div>
                <div class="reg-verdict ${verdict.cls}">
                    <div class="verdict-icon">${verdict.icon}</div>
                    <div>
                        <div class="verdict-title">${verdict.title}</div>
                        <div class="verdict-sub">${verdict.sub}</div>
                    </div>
                </div>
            </div>

            ${caveatInline}

            ${kronorHtml}

            <div class="bak-botten rund-6 fs-md lh-1_6 marg-t-14 pad-14-16">
                <strong>Tolkning:</strong> ${tolkning}
            </div>

            ${_regTrappaVisas(stegUt) ? '<div class="chart-container mt-14"><div id="chart-reg-trappa"></div></div>' : ''}
            ${waterfallHtml ? `
            <details class="marg-t-18" open>
                <summary class="pekare fw-600 pad-8-0 ej-markerbar">Hur räknas siffran fram? (steg för steg)
                    <span class="info-tip" data-tooltip="Verktyget börjar med den råa löneskillnaden och visar hur stor del som förklaras av varje strukturell variabel. Det som blir kvar i sista steget är den oförklarade löneskillnaden.">${ikon('info', 14)}</span>
                </summary>
                <p class="text-dampad-sm lh-1_55 marg-8-0-6">
                    Modellen skattas i flera steg, med en kontrollvariabel till i varje. Trappan visar löneskillnaden efter varje steg, och förklaringsbudgeten under den hur många procentenheter varje steg tar. Det som blir kvar i sista steget är den oförklarade skillnaden.
                </p>
                ${stegUt.utelamnat ? `<p class="k-mask-note">${esc(stegUt.not)}</p>` : ''}
                ${budgetHtml}
                ${ansvarHtml}
                <div class="reg-waterfall${_regTrappaVisas(stegUt) ? ' sr-only' : ''}"${_regTrappaVisas(stegUt) ? ' aria-label="Stegen som lista"' : ''}>${waterfallHtml}</div>
                ${explainedRowHtml(budget)}
            </details>
            ` : ''}

            <details class="mt-14" open>
                <summary class="pekare fw-600 pad-8-0 ej-markerbar">Var inom organisationen finns den oförklarade skillnaden? (per BAS-intervall)
                    <span class="info-tip" data-tooltip="För varje BAS-intervall körs en egen analys. Visar vilka delar av organisationen som driver den oförklarade skillnaden, snarare än ett genomsnitt för hela organisationen.">${ikon('info', 14)}</span>
                </summary>
                <p class="text-dampad-sm lh-1_55 marg-8-0-6">
                    Inom varje BAS-intervall körs en separat analys (som rensar bort åldersskillnaden). Visar var i organisationen den oförklarade skillnaden ligger — inte alla BAS bidrar lika mycket till totalbilden.
                </p>
                ${caveatInline}
                <div class="chart-container"><div id="chart-perbas-gap"></div></div>
                <label class="perbas-stats-toggle">
                    <input type="checkbox" id="perbas-show-stats"> Visa statistiska detaljer (p- och q-värden)
                </label>
                <div class="rulla-x">
                    <table id="perbas-table" class="data-table hide-stats fs-sm marg-t-8">
                        <thead><tr>
                            <th>BAS</th>
                            <th class="t-hoger">N</th>
                            <th class="t-mitt">Kv/Mä</th>
                            <th class="t-hoger">Oförklarad skillnad</th>
                            <th class="t-mitt">Signal <span class="info-tip" data-tooltip="Klarspråkstolkning av statistiken. Titta närmare = säkerställd även efter korrigering och minst 3 % (verktygets storleksgräns). Dokumentera = säkerställd men under 3 %. Osäkert utslag = ser signifikant ut i råa p-värdet men håller inte efter korrigering för multipel jämförelse. Inget utslag = ingen säkerställd oförklarad skillnad.">${ikon('info', 14)}</span></th>
                            <th class="col-stat t-mitt">p-värde (rå) <span class="info-tip" data-tooltip="Råa p-värdet från regressionen. p<0,05 = statistiskt säkerställd ifall enstaka test. Vid många samtidiga tester (multipel jämförelse) bör det justerade q-värdet användas istället.">${ikon('info', 14)}</span></th>
                            <th class="col-stat t-mitt">q-värde (BH-justerat) <span class="info-tip" data-tooltip="p-värdet justerat för att många grupper prövas samtidigt (Benjamini–Hochberg). Under 0,05: skillnaden håller också efter justeringen. Symboler: nålen = säkerställt efter korrigering och minst 3 % (verktygets storleksgräns), ögat = säkerställt efter korrigering men under 3 %, varningstriangeln = säkerställt i det råa p-värdet men inte efter korrigering.">${ikon('info', 14)}</span></th>
                            <th class="t-mitt" title="Öppnar bevis-popup som visar exakt formel, ingångsdata och BH-FDR-context för denna rad.">Bevis</th>
                        </tr></thead>
                        <tbody>${perBasRows || '<tr><td class="t-mitt f-dampad" colspan="8">Inga BAS-intervall har tillräcklig könsbalans (≥' + statGolv() + ' av varje kön).</td></tr>'}</tbody>
                    </table>
                </div>
                <p class="text-dampad-xs lh-1_5 marg-t-8">
                    <strong>Multipel jämförelse-korrigering:</strong> ${esc(_bhTextFor(allM))}
                </p>
            </details>

            ${(() => {
                const qr = _regKvantilBerakna();
                _regKvantilSenast = null;
                if (!qr) return '';
                const validResults = qr.results.filter(x => !x.error);
                if (validResults.length < 2) return '';
                _regKvantilSenast = validResults;   // diagrammet ritas när kortet står i sidan
                const p10 = qr.results.find(x => x.tau === 0.1);
                const p50 = qr.results.find(x => x.tau === 0.5);
                const p90 = qr.results.find(x => x.tau === 0.9);
                const pctTecken = v => `${v >= 0 ? '+' : '−'}${svPct(Math.abs(v), 1)}`;
                const peTecken = v => `${v >= 0 ? '+' : '−'}${svTal(Math.abs(v), 1)}`;
                const kiCell = (ki, fmt) => (ki ? `${fmt(ki.lag)} till ${fmt(ki.hog)}` : qr.kiVantar ? '<span class="f-dampad">räknas i bakgrunden…</span>' : '<span class="f-dampad">–</span>');
                // Ingen färg på skattningarna: utan prövning mot noll säger storleken ensam inget om status (ADR-59, ADR-63).
                const fmtRow = (label, helper, x) => {
                    if (!x || x.error) return `<tr><td>${label}</td><td><em class="f-dampad">Kunde ej estimeras</em></td><td>–</td><td>${helper}</td></tr>`;
                    return `<tr><td>${label}</td><td class="halvfet tabelltal">${pctTecken(x.konPct)}</td><td class="tabelltal">${kiCell(x.ki, pctTecken)}</td><td class="text-dampad-sm">${helper}</td></tr>`;
                };
                const diff = qr.diff || { varde: null, ki: null };
                const diffRad = typeof diff.varde === 'number' && isFinite(diff.varde)
                    ? `<tr><td><strong>P90 − P10</strong></td><td class="halvfet tabelltal">${peTecken(diff.varde)} procentenheter</td><td class="tabelltal">${kiCell(diff.ki, v => `${peTecken(v)}`)}</td><td class="text-dampad-sm">Skillnaden mellan toppen och botten. Negativ: löneskillnaden till kvinnornas nackdel är större bland de högst betalda</td></tr>`
                    : '';
                // Tolkningen (ADR-63) sägs bara när bootstrap-KI:t för skillnaden P90 − P10 utesluter noll.
                let tolkning = '';
                if (diffRad) {
                    if (diff.ki && diff.ki.hog < 0) {
                        tolkning = `<strong>Glastaket väger tyngre än det klibbiga golvet</strong> — kvinnor i den högre delen av löneskalan halkar efter mer än kvinnor i botten. Konfidensintervallet för skillnaden mellan P90 och P10 utesluter noll.`;
                    } else if (diff.ki && diff.ki.lag > 0) {
                        tolkning = `<strong>Det klibbiga golvet väger tyngre än glastaket</strong> — kvinnor i den lägre delen av löneskalan halkar efter mer än kvinnor i toppen. Konfidensintervallet för skillnaden mellan P90 och P10 utesluter noll.`;
                    } else if (diff.ki) {
                        tolkning = `Ingen säkerställd skillnad mellan delarna av lönefördelningen.`;
                    } else if (qr.kiUtelamnad) {
                        tolkning = `Utan konfidensintervall går det inte att säga om löneskillnaden skiljer sig mellan delarna av lönefördelningen.`;
                    }
                }
                if (qr.kiVantar) wrap.dataset.kvantilNyckel = qr.nyckel; else delete wrap.dataset.kvantilNyckel;
                return `
                <details class="mt-14" open>
                    <summary class="pekare fw-600 pad-8-0 ej-markerbar">Löneskillnad i olika delar av lönefördelningen
                        <span class="info-tip" data-tooltip="Huvudmodellen skattar löneskillnaden i medelvärdet. Kvantilregression skattar skillnaden i olika delar av fördelningen var för sig. P10 = botten av lönefördelningen (det klibbiga golvet), P50 = median, P90 = toppen (glastaket). Visar om skillnaden är större i vissa lönenivåer.">${ikon('info', 14)}</span>
                    </summary>
                    <p data-hjalptext class="text-dampad-sm lh-1_55 marg-8-0-6">
                        Huvudmodellen ovan skattar löneskillnaden vid <em>medelvärdet</em>. Kvantilregression visar skillnaden i olika delar av lönefördelningen. Det är viktigt om skillnaden är ojämnt fördelad, till exempel större bland de lägst betalda än bland de högst betalda.
                    </p>
                    <div class="rulla-x">
                        <div class="chart-container"><div id="chart-reg-kvantil"></div></div>
                        <table class="data-table fs-sm marg-t-8">${antalCaption(qr.nKv, qr.nMa)}
                            <thead><tr><th>Position i lönefördelningen</th><th class="t-hoger">Oförklarad skillnad</th><th>95 % KI (bootstrap)</th><th>Tolkning</th></tr></thead>
                            <tbody>
                                ${fmtRow('<strong>P10 — Klibbigt golv</strong>', 'Löneskillnaden bland de lägst betalda', p10)}
                                ${fmtRow('<strong>P50 — Medianen</strong>',     'Löneskillnaden i mittersta delen av lönefördelningen', p50)}
                                ${fmtRow('<strong>P90 — Glastak</strong>',   'Löneskillnaden bland de högst betalda', p90)}
                                ${diffRad}
                            </tbody>
                        </table>
                    </div>
                    ${tolkning ? `<div class="bak-info-yta ram-v-3-info rund-4 fs-sm marg-t-10 pad-10-14">${tolkning}</div>` : ''}
                    <p class="text-dampad-xs lh-1_5 marg-t-8">
                        <em>Metod: IRLS (Iteratively Reweighted Least Squares) på samma variabler som huvudregressionen (utan yrkesgrupp inom BAS)${(() => { const f = _rgModellFras({ ...forklaringsmodell(), yrkesgrupp: false }); return f ? `: kön, ${f}` : ': bara kön'; })()} — en approximation av kvantillösningen, inte den exakta minimeringen. Kräver minst 50 observationer för stabilt resultat.
                        ${qr.kiUtelamnad ? esc(qr.kiUtelamnad) : `Konfidensintervallet är ett percentil-bootstrap med ${qr.kiB} omsamplingar av raderna, seedat ur datat så att det blir detsamma varje gång${qr.kiVantar ? '; det räknas i bakgrunden och visas strax' : ''}. Tolkningen om golv och tak görs bara när intervallet för P90 − P10 utesluter noll.`}</em>
                    </p>
                </details>`;
            })()}

            <details class="mt-14" open>
                <summary class="farg-primary pekare fw-600 pad-8-0 ej-markerbar">Hur tolkas signifikansvärdena?</summary>
                <div class="bak-yta rund-6 fs-sm lh-1_6 marg-t-8 pad-14-16">
                    <p class="marg-0-0-10"><strong>p-värdet</strong> svarar på frågan: <em>"Hur sannolikt är det att se en minst så stor löneskillnad mellan könen om det i verkligheten inte fanns någon?"</em> Lågt p-värde betyder att skillnaden är svår att förklara med enbart slumpmässig variation och bör tas på allvar.</p>
                    <table class="tabell-samman fs-sm marg-8-0">
                        <tr><td class="pad-3-12-3-0 lodrat-topp"><strong class="farg-kritisk">p &lt; 0,001</strong></td><td>Extremt signifikant — utan verklig skillnad skulle en så stor skillnad uppstå i färre än 1 av 1 000 fall. Mycket starkt stöd för verklig löneskillnad.</td></tr>
                        <tr><td class="pad-3-12-3-0 lodrat-topp"><strong class="farg-kritisk">p &lt; 0,01</strong></td><td>Mycket signifikant — färre än 1 av 100 fall. Starkt stöd för verklig skillnad.</td></tr>
                        <tr><td class="pad-3-12-3-0 lodrat-topp"><strong class="farg-varning">p &lt; 0,05</strong></td><td>Signifikant — färre än 5 av 100 fall. Den vanliga tröskeln för "statistiskt säkerställd" skillnad.</td></tr>
                        <tr><td class="pad-3-12-3-0 lodrat-topp"><strong class="f-dampad">p ≥ 0,05</strong></td><td>Ej signifikant — datat är förenligt med att ingen verklig skillnad finns. Observerad skillnad kan vara slump.</td></tr>
                    </table>
                    <p class="marg-10-0-6"><strong>Symbolerna i per-BAS-tabellen:</strong></p>
                    <ul class="marg-0-0-10-22">
                        <li>${ikon('nal')} = signifikant <strong>och</strong> minst 3 % (verktygets storleksgräns) — Titta närmare: pröva om skillnaden har sakliga skäl</li>
                        <li>${ikon('oga')} = signifikant men under 3 % — Dokumentera: skriv ner sakliga skäl och följ upp</li>
                        <li><span class="f-dampad">Inget märke</span> = inte signifikant, eller signifikant men praktiskt obetydlig storlek</li>
                    </ul>
                    <p class="notis-varning fs-sm marg-10-0-0 pad-8-12">
                        <strong>Viktig nyans – statistisk och praktisk signifikans:</strong>
                        Vid stora urval kan även mycket små skillnader bli "statistiskt signifikanta". En skillnad på 0,3 % kan ha p &lt; 0,001 utan att vara åtgärdsvärt i praktiken.
                        Bedöm <em>båda</em> dimensionerna: är skillnaden <strong>statistiskt</strong> säkerställd (p &lt; 0,05) <em>och</em> stor nog att spela roll? Signalen <em>Titta närmare</em> kräver minst 3 % (verktygets storleksgräns); den praktiska betydelsen är din bedömning. Lagen kräver att du analyserar varje skillnad, oavsett storlek.
                    </p>
                </div>
            </details>

            <details class="mt-14" open>
                <summary class="text-dampad-sm pekare fw-600 pad-8-0 ej-markerbar">Teknisk specifikation (för statistiker)</summary>
                <div class="reg-tech mt-8">
                    <p>Denna sektion innehåller modellens fullständiga tekniska specifikation och är inte nödvändig för att tolka resultaten ovan. Den är till för dig som har statistisk bakgrund och vill granska metoden.</p>
                    <h3>Modellspecifikation</h3>
                    <table class="reg-tech-table">
                        <tr><th>Modellnotation</th><td><code>log(lön) ~ ${esc(r.modelDesc)}</code></td></tr>
                        <tr><th>Estimationsmetod</th><td>OLS (Ordinary Least Squares)</td></tr>
                        <tr><th>Standardfel</th><td>HC3 robust (Long &amp; Ervin 2000)</td></tr>
                        <tr><th>Observationer med hävstång &gt; 0,99 (bidrar inte till HC3)</th><td>${r.hHoga ?? 0}</td></tr>
                        <tr><th>Antal observationer (n)</th><td>${r.n} (Kvinnor: ${r.nKvAnalysed}, Män: ${r.nMaAnalysed})</td></tr>
                        <tr><th>Antal parametrar (k)</th><td>${r.k}</td></tr>
                        <tr><th>Förklaringsgrad (R²)</th><td>${svPct((r.R2*100), 1)}</td></tr>
                        <tr><th>Justerad R²</th><td>${svPct((r.adjR2*100), 1)}</td></tr>
                    </table>
                    <h3>Kön-koefficient (oförklarad löneskillnad)</h3>
                    <table class="reg-tech-table">
                        <tr><th>Effekt (exp(β)−1)</th><td>${sign}${svPct(r.konPct, 4)}</td></tr>
                        <tr><th>SE (HC3 robust)</th><td>${svTal(r.seKonR, 5)}</td></tr>
                        <tr><th>SE (klassisk)</th><td>${svTal(r.seKonC, 5)}</td></tr>
                        <tr><th>t-statistika</th><td>${svTal(r.tStat, 3)}</td></tr>
                        <tr><th>p-värde</th><td>${sig}</td></tr>
                        <tr><th>95% KI (HC3 robust)</th><td>${svPct(r.konPctLow, 4)} till ${svPct(r.konPctHigh, 4)}</td></tr>
                        <tr><th>95% KI (klassisk)</th><td>${svPct(r.konPctLowClassical, 4)} till ${svPct(r.konPctHighClassical, 4)}</td></tr>
                    </table>
                    ${r.ageEffect != null ? `<h3>Ålderseffekt</h3>
                    <table class="reg-tech-table">
                        <tr><th>Procentuell löneförändring per levnadsår</th><td>${r.ageEffect >= 0 ? '+' : ''}${svPct(r.ageEffect, 3)}</td></tr>
                        <tr><th>p-värde</th><td>${_formatPValue(r.ageP)}</td></tr>
                    </table>` : ''}
                    ${r.basEffekter ? `
                    <h3>BAS-effekter (indikatorvariabler)</h3>
                    <p>Varje BAS-intervall har en egen indikator; det alfabetiskt första intervallet, <code>${esc(r.basRef)}</code>, är referens. Koefficienten är intervallets lönenivå i procent mot referensen, efter kontroll för kön och ålder — inget antagande om lika stora steg mellan bokstäverna.</p>
                    <table class="reg-tech-table">${antalCaption(r.nKvAnalysed, r.nMaAnalysed)}
                        <tr><th>BAS</th><th>Nivå mot ${esc(r.basRef)}</th><th>95% KI</th><th>p-värde</th></tr>
                        ${r.basEffekter.map(e => `<tr><td>${esc(e.bas)}</td><td>${e.pct >= 0 ? '+' : ''}${svPct(e.pct, 1)}</td><td>${svPct(e.low, 1)} till ${svPct(e.high, 1)}</td><td>${_formatPValue(e.p)}</td></tr>`).join('')}
                    </table>
                    ` : ''}
                    <h3>Modellspecifikationer som testades (kaskadval)</h3>
                    <p class="lh-1_7">${triedRow}</p>
                </div>
            </details>
        </div>
    `; tillampaDataStil(wrap);

    // #lifecycle: rendera sekundäranalys efter att placeholder finns i DOM
    renderLifecycleAnalysis();

    // Per-BAS-diagram + växel för statistiska detaljer (pedagogik-omgången).
    // Diagrammet ritas efter innerHTML så containern finns; tabellen är kvar
    // som tillgänglighetsalternativ och p/q ligger bakom växeln.
    _renderPerBasGapChart(r.perBas, bhQByBas);
    // Trappan och kvantilkurvan: bilder av tal som kortet redan visar i tabell.
    const trappa = document.getElementById('chart-reg-trappa');
    if (trappa) ritaFigur(trappa, _regTrappaFigur(seqOk, yrkeVisas ? r.yrkesSteg : null, fmT.fras));
    const kvantil = document.getElementById('chart-reg-kvantil');
    if (kvantil && _regKvantilSenast) ritaFigur(kvantil, _regKvantilFigur(_regKvantilSenast));
    const statsToggle = document.getElementById('perbas-show-stats');
    const perBasTable = document.getElementById('perbas-table');
    if (statsToggle && perBasTable) {
        statsToggle.addEventListener('change', () => {
            perBasTable.classList.toggle('hide-stats', !/** @type {HTMLInputElement} */ (statsToggle).checked);
        });
    }

    // Bevis-popup för per-BAS-rader
    // Bind handlers efter att tabellen renderats. Vi söker rätt på BAS-
    // namnet i r.perBas + slår upp BH-FDR-q. allM är totala antal OK-tester
    // (för BH-FDR-context i bevis-modalen).
    wrap.querySelectorAll('.btn-evidence[data-bas-evidence]').forEach(btn => {
        btn.addEventListener('click', () => {
            const basName = /** @type {HTMLElement} */ (btn).dataset.basEvidence;
            const p = (r.perBas || []).find(x => x.bas === basName);
            if (!p) return;
            const q = bhQByBas[basName];
            _openEvidenceModal(_evidenceForPerBasRow(p, { q, allM }));
        });
    });
    return r;
}

/**
 * Renderar Blinder-Oaxaca-kortet i EU-matris-fliken (efter renderRegressionCard).
 * @param {any} [reg] huvudregressionens resultat från den som just kört den (ADR-17); bär det bortvalda (ADR-56)
 */
function renderBlinderOaxacaCard(reg) {
    const wrap = document.getElementById('blinder-oaxaca-card');
    if (!wrap) return;
    const modell = forklaringsmodell();
    if (!modell.bas && !modell.alder) { wrap.innerHTML = ''; return; }   // endast kön: inget att dela upp (ADR-56)
    const r = runBlinderOaxaca();
    if (!r) {
        wrap.innerHTML = `<div class="card ram-v-4-dampad">
            <h3 class="marg-0-0-8">Förklarad och oförklarad löneskillnad</h3>
            <p class="farg-dampad fs-md marg-0">
                För få observationer (kräver minst 50 personer totalt och ${statGolv()} av varje kön).
            </p>
        </div>`;
        return;
    }
    const fmtPct = v => (v >= 0 ? '+' : '') + svPct(v, 1);
    // Metoden räknar män mot kvinnor i log-rummet; kortet visar talen kvinnor mot män, som resten av verktyget.
    // Komponenterna är additiva på log-skalan, så tecknet byts där och räknas sedan om till procent.
    const pctKv = c => (Math.exp(-c) - 1) * 100;
    const ragap = pctKv(r._raw.rawGapLog), forklarat = pctKv(r._raw.q), oforklarat = pctKv(r._raw.u + r._raw.i);

    // Andelar: rågap = förklarat + oförklarat (i log-rummet, additivt)
    const explainedShare = r._raw.q / r._raw.rawGapLog;
    const unexplainedShare = (r._raw.u + r._raw.i) / r._raw.rawGapLog;
    // Visa som positiva andelar oavsett tecken
    const explainedPctOfGap = Math.abs(explainedShare * 100);
    const unexplainedPctOfGap = Math.abs(unexplainedShare * 100);

    // Texterna följer modellen (ADR-56); noteringen om det bortvalda tas ur huvudregressionen.
    const t = _fmTexter(r.modell);
    const bortvalt = reg && !reg.error && Array.isArray(reg.bortvalt) ? reg.bortvalt : [];
    const variabelText = [...(r.modell.alder ? ['ålder'] : []),
        ...(r.modell.bas && !r.modell.yrkesgrupp ? [`en indikator per BAS-intervall, referens BAS ${esc(String(r.basRef))}`] : []),
        ...(r.modell.yrkesgrupp ? [`en indikator per yrkesgrupp inom BAS, referens ${esc(String(r.gruppRef))}`] : [])].join(' och ');
    // Per-variabel-tabell
    const compLabel = { intercept: 'Konstant (grundnivå)', age: 'Ålder', bas: 'BAS-intervall (alla indikatorer)', yrke: 'Yrkesgrupp inom BAS (alla indikatorer; BAS ingår)' };
    const compRows = Object.entries(r.components).map(([k, v]) => `
        <tr>
            <td><strong>${compLabel[k]}</strong></td>
            <td class="t-tal">${fmtPct(pctKv(v.q))}</td>
            <td class="t-tal">${fmtPct(pctKv(v.u))}</td>
            <td class="farg-dampad tabelltal ta-hoger">${fmtPct(pctKv(v.i))}</td>
        </tr>`).join('');

    wrap.innerHTML = `
        <div class="card ram-v-4-granska-ljus">
            <h3 class="marg-0-0-6">Förklarad och oförklarad löneskillnad
                <span class="info-tip" data-tooltip="Standardmetod inom arbetsmarknadsekonomi (Blinder 1973, Oaxaca 1973). Delar upp den råa skillnaden i tre delar: hur mycket beror på att kvinnor och män har olika karakteristika (förklarat), och hur mycket beror på att samma egenskaper betalas olika (oförklarat — det statistiken inte kan förklara, inte ett mått på diskriminering). Används av Medlingsinstitutet.">${ikon('info', 14)}</span>
            </h3>
            <p class="text-dampad-sm lh-1_55 marg-0-0-14">
                Den råa skillnaden i månadslön delas upp i den del som <em>förklaras</em> av strukturella skillnader
                (${esc(t.fras)}) och den del som är <em>oförklarad</em> — det som <strong>inte</strong> kan
                tillskrivas att kvinnor och män i organisationen skiljer sig i ${esc(t.forklarasAv)}.
                Den oförklarade delen är det lönekartläggningen ska adressera.${bortvalt.length ? ` ${esc(bortvalt.map(b => _fmNoteringText(b).replace(' nedan', ' här')).join(' '))}` : ''}
            </p>

            <div class="rutnat gap-14 kolumner-3-lika marg-b-18">
                <div class="bak-accent-yta rund-8 pad-14 ta-mitt">
                    <div class="etikett-versal">Rå skillnad, kvinnor mot män</div>
                    <div class="farg-accent-mork fs-nyckeltal fw-700 marg-t-4">${fmtPct(ragap)}</div>
                    <div class="finstilt">n = ${r.nKv} kvinnor + ${r.nMa} män</div>
                </div>
                <div class="bak-ok-bg rund-8 pad-14 ta-mitt">
                    <div class="etikett-versal">Förklarat av ${esc(t.fras)}, procentenheter</div>
                    <div class="farg-ok fs-nyckeltal fw-700 marg-t-4">${svTal(Math.abs(forklarat), 1)}</div>
                    <div class="finstilt">≈ ${svPct(explainedPctOfGap, 0)} av den råa skillnaden</div>
                </div>
                <div class="bak-varning-bg rund-8 pad-14 ta-mitt">
                    <div class="etikett-versal">Oförklarat, procentenheter</div>
                    <div class="farg-varning fs-nyckeltal fw-700 marg-t-4">${svTal(Math.abs(oforklarat), 1)}</div>
                    <div class="finstilt">≈ ${svPct(unexplainedPctOfGap, 0)} av den råa skillnaden</div>
                </div>
            </div>

            <p class="text-dampad-sm lh-1_55 marg-0-0-14">Den råa skillnaden räknas som i kortet ovan: kvinnors lön mot mäns, negativt när kvinnor ligger lägre; de två delarna är hur många procentenheter av det som förklaras respektive blir kvar${(forklarat > 0) !== (ragap > 0) ? ' (den förklarade delen drar här åt motsatt håll mot den råa skillnaden)' : ''}. Den oförklarade delen här och huvudtalet ovan mäter samma skillnad med samma variabler (${variabelText}); de skiljer sig något eftersom uppdelningen skattar kvinnors och mäns lönesättning var för sig. (Metoden räknar internt mäns lön mot kvinnors; talen är omräknade.)</p>

            <details open>
                <summary class="farg-text pekare fw-600">Visa uppdelning per variabel</summary>
                <div class="marg-t-10">
                    <table class="data-table st-09">${antalCaption(r.nKv, r.nMa)}
                        <thead>
                            <tr>
                                <th>Variabel</th>
                                <th class="t-hoger" title="Hur mycket av den råa skillnaden förklaras av att kvinnor och män har olika fördelning på just denna variabel">Förklarat (Q)</th>
                                <th class="t-hoger" title="Hur mycket beror på att män och kvinnor får olika lön för samma värde på denna variabel">Koefficient-effekt (U)</th>
                                <th class="t-hoger" title="Samspel: skillnad i fördelning × skillnad i avkastning. Räknas som oförklarat.">Samspel (I)</th>
                            </tr>
                        </thead>
                        <tbody>${compRows}</tbody>
                    </table>
                    <p data-hjalptext class="text-dampad-xs lh-1_5 marg-10-0-0">
                        <strong>Tolkning:</strong> Klassisk Blinder-Oaxaca-uppdelning. Q = skillnader i egenskaper (${esc(t.fras)}) värderade
                        med kvinnornas lönesättning. U = skillnad i hur samma egenskaper betalas. I = samspel mellan de två.
                        Förklarat = Q. Oförklarat = U + I.${r.modell.bas ? ` Raden ${r.modell.yrkesgrupp ? 'Yrkesgrupp inom BAS' : 'BAS-intervall'} är summan över alla indikatorer; en grupp som
                        bara finns hos ett kön hamnar i samspelet.` : ''}
                    </p>
                </div>
            </details>

            <div class="bak-varning-bg ram-v-3-varning rund-4 fs-sm lh-1_55 marg-t-14 pad-10-12">
                <strong>Vad betyder detta i samverkan?</strong><br>
                Den <em>förklarade</em> delen (${svTal(Math.abs(forklarat), 1)} procentenheter) beror på att kvinnor och män
                i organisationen skiljer sig i ${esc(t.forklarasAv)}. Den hänsyn man rimligt
                kan ta är dessa strukturella skillnader. Den <em>oförklarade</em> delen (${svTal(Math.abs(oforklarat), 1)} procentenheter)
                är vad lönekartläggningen ska <strong>analysera djupare</strong> — sakliga skäl
                måste finnas dokumenterade för att motivera den.
            </div>
        </div>
    `;
}

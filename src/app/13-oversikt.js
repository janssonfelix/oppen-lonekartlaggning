// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Compliance overview ----
function setCompCard(id, count, total, valueText, cardState) {
    const card = document.getElementById(id);
    const icon = document.getElementById(`${id}-icon`);
    const val  = document.getElementById(`${id}-val`);
    if (!card || !icon || !val) return;
    val.textContent = valueText;
    icon.innerHTML = { ok: ikon('bock'), warn: ikon('statusVarning'), crit: ikon('stopp'), na: '—' }[cardState] || '—';
    card.className = `compliance-card ${cardState}`;
}

function updateCompliance() {
    renderGapUppdelning();
    const overview = document.getElementById('compliance-overview');
    if (!overview || !getData().length) return;
    overview.style.display = 'block';
    const d   = getData();
    const bas = getBasIntervals();

    // 1–2. Lönegap > 5 % och könsskevhet — bara i jämförbara BAS (båda könen ≥ k),
    // samma regel som Lika arbete och Underlagets kvalitet använder.
    const jb = _dqJamforbaraBas(d, kInstalld());   // säger vad exporterna kan jämföra (ADR-51)
    const gapTotal = jb.jamforbara.length;
    const maskText = jb.maskerade.length ? ` · ${jb.maskerade.length} maskeras` : '';
    let gapCrit = 0, skevCount = 0;
    jb.jamforbara.forEach(b => {
        const df = d.filter(r => r.bas === b);
        const kv = df.filter(r => r.kon.includes('kvinna')).map(r => r.lon);
        const ma = df.filter(r => r.kon === 'man' || r.kon === 'män').map(r => r.lon);
        if (Math.abs((Stat.median(kv) / Stat.median(ma)) * 100 - 100) > 5) gapCrit++;
        const tot = kv.length + ma.length;
        if (kv.length / tot < 0.4 || ma.length / tot < 0.4) skevCount++;
    });
    if (gapTotal === 0) {
        setCompCard('comp-gap', 0, 0, `Inga jämförbara BAS-intervall${maskText}`, 'na');
        setCompCard('comp-skev', 0, 0, `Inga jämförbara BAS-intervall${maskText}`, 'na');
    } else {
        setCompCard('comp-gap', gapCrit, gapTotal, `${gapCrit} av ${gapTotal} jämförbara BAS-intervall${maskText}`, gapCrit === 0 ? 'ok' : gapCrit >= 3 ? 'crit' : 'warn');
        setCompCard('comp-skev', skevCount, gapTotal, `${skevCount} av ${gapTotal} jämförbara BAS-intervall${maskText}`, skevCount === 0 ? 'ok' : 'warn');
    }

    // 3. Policy P10-underläge — referensen namnges; utan referens ett tomläge (ADR-28)
    const polLabel = document.getElementById('comp-pol-label');
    if (polLabel) polLabel.textContent = harReferens() ? `Under ${referensKortnamn()}:s P10` : 'Under ställningstagandets P10';
    const polSub = document.getElementById('comp-pol-sub');
    if (polSub) polSub.textContent = referensNamn();
    if (!harReferens()) {
        setCompCard('comp-pol', 0, 0, 'Kräver lönepolitiskt ställningstagande', 'na');
    } else {
        let polLow = 0, polTotal = 0;
        bas.forEach(b => {
            const pol = policyFor(null, b);
            if (!pol || !pol.p10) return;
            if (d.filter(r => r.bas === b).length < kInstalld()) return;   // räknar det exporterna kan jämföra (ADR-51)
            polTotal++;
            if (Stat.median(d.filter(r => r.bas === b).map(r => r.lon)) < pol.p10) polLow++;
        });
        // polTotal === 0 betyder att policyfilen saknar BAS-nivårader (t.ex. en
        // ren AID-policy). Då finns inget att jämföra mot — grönt "0 av 0" vore
        // falskt lugnande, så kortet blir 'na'.
        if (polTotal === 0) {
            setCompCard('comp-pol', 0, 0, `${referensNamn()} saknar BAS-nivårader`, 'na');
        } else {
            setCompCard('comp-pol', polLow, polTotal, `${polLow} av ${polTotal} BAS-intervall`, polLow === 0 ? 'ok' : polLow >= 2 ? 'crit' : 'warn');
        }
    }

    // 4. Benchmark
    if (state.statistik.length > 0) {
        let bmLow = 0, bmTotal = 0;
        const seen = new Set();
        d.forEach(r => {
            const m = r.yrke.match(/^(\d+)/);
            const aid = m ? m[1] : r.yrke;
            const key = `${aid}|${r.bas}`;
            if (seen.has(key)) return;
            seen.add(key);
            const statRow = state.statistik.find(s => s.aid === aid && s.bas === r.bas) || state.statistik.find(s => s.aid === aid && !s.bas);
            if (!statRow) return;
            bmTotal++;
            const orgMed = Stat.median(d.filter(x => { const mm = x.yrke.match(/^(\d+)/); return (mm ? mm[1] : x.yrke) === aid && x.bas === r.bas; }).map(x => x.lon));
            if (orgMed < statRow.median) bmLow++;
        });
        if (bmTotal === 0) setCompCard('comp-bm', 0, 0, 'Ingen matchning hittad', 'na');
        else if (bmLow === 0) setCompCard('comp-bm', 0, bmTotal, `0 av ${bmTotal} yrkesgrupper`, 'ok');
        else setCompCard('comp-bm', bmLow, bmTotal, `${bmLow} av ${bmTotal} yrkesgrupper`, bmLow / bmTotal > 0.5 ? 'crit' : 'warn');
    }
    // Länken till Jämförelse-fliken bara när fliken finns (jämförelsestatistik inläst).
    const bmLank = document.querySelector('#comp-bm .comp-lank');
    if (bmLank) /** @type {HTMLElement} */ (bmLank).hidden = !state.statistik.length;
}

// ---- Underlagets kvalitet (ADR-19): svagaste länken avgör ----
/** @param {{reg?: any}} [val] reg: regressionen när anroparen just kört den — ett värde som skickas vidare, ingen cache (ADR-17) */
function bedomningUnderlag({ reg: given } = {}) {
    const d = getData();
    if (!d.length) return null;
    const reg = given || runOLSRegression();
    const modell = reg.error ? 'fel' : (reg.modelName === 'full' ? 'full' : 'minimal');
    const mde = reg.error ? null : _dqMdeFranSe(reg.seKonR);
    const b = _dqBedomUnderlag(d, { k: kInstalld(), audit: state.dataAudit, mde, modell });   // jämförbarheten gäller det som lämnar verktyget (ADR-51)
    // Kontrollen av AID-kodningen (ADR-33) läggs till datakvalitetens kriterier.
    let aid = [];
    try { aid = _akAidKriterier(d, { k: kInstalld(), harAnsvar: !!state.ansvarKolumn }); }
    catch (e) { rapporteraFel('Underlagets kvalitet: AID-kodning', e); }
    const kriterier = [...b.kriterier, ...aid];
    const rang = { ok: 0, varning: 1, kritisk: 2 };
    return { ...b, status: kriterier.reduce((s, c) => (rang[c.status] > rang[s] ? c.status : s), b.status), kriterier };
}

const UK_ETIKETT = { ok: 'OK', varning: 'Varning', kritisk: 'Kritisk' };
function renderUnderlagetsKvalitet() {
    const host = document.getElementById('underlagets-kvalitet');
    if (!host) return;
    const b = bedomningUnderlag();
    const detaljer = document.getElementById('underlag-detaljer');
    if (!b) { host.hidden = true; host.removeAttribute('data-status'); _laNyckel('nyckel-ov-kvalitet', ''); return; }
    host.hidden = false;
    host.dataset.status = b.status;
    _laNyckel('nyckel-ov-kvalitet', UK_ETIKETT[b.status] || '', b.status === 'kritisk');
    /** @type {HTMLElement} */ (document.getElementById('underlagets-kvalitet-status')).innerHTML =
        `Underlaget: <span class="uk-marke uk-${b.status}">${UK_ETIKETT[b.status]}</span>`;
    /** @type {HTMLElement} */ (document.getElementById('underlagets-kvalitet-rader')).innerHTML = b.kriterier.map(c => `
        <div class="uk-rad" data-id="${c.id}">
            <span class="uk-marke uk-${c.status}">${UK_ETIKETT[c.status]}</span>
            <div><strong>${esc(c.namn)}</strong><div class="uk-text">${esc(c.text)}</div></div>
        </div>`).join('');
    const antalOk = b.kriterier.filter(c => c.status === 'ok').length;
    const avvik = b.kriterier.filter(c => c.status !== 'ok').map(c => `${UK_ETIKETT[c.status]}: ${c.namn}`);
    const sam = document.getElementById('uk-sammanfattning');
    if (sam) sam.textContent = `${antalOk} av ${b.kriterier.length} kriterier OK` + (avvik.length ? ` · ${avvik.join(' · ')}` : '') + ' — visa detaljer';
    const fall = document.getElementById('uk-fallbar');
    // Utfälld vid varning — och vid en konsistensvarning (rutan ligger inuti; "OK"-rutan räknas inte).
    const konsVarning = document.querySelector('#consistency-banner-container .consistency-banner:not(.ok)');
    // Fälls ut/ihop bara när läget ändras — annars står användarens eget val kvar vid omritning.
    const nyckel = `${b.status}|${konsVarning ? 1 : 0}`;
    if (fall && fall.dataset.lage !== nyckel) { /** @type {HTMLDetailsElement} */ (fall).open = b.status !== 'ok' || !!konsVarning; fall.dataset.lage = nyckel; }
    if (detaljer) detaljer.hidden = false;
}

// ---- #10 Bootstrap-CI för mediankvoten kvinnor/män ----
/**
 * Beräknar 95%-konfidensintervall för median-ratio (kvinnor / män)
 * via percentil-bootstrap. Cachas i state.bootstrapCI så det inte räknas om
 * vid varje rendering.
 *
 * Metod: dra B = 600 sampel med återläggning från vardera könsgrupp,
 * beräkna mediankvot per sampel, ta percentil [2.5, 97.5] för CI.
 *
 * För N > 5000: vi sampar enbart en delmängd om N kvar > 2000 per grupp
 * eftersom medianskattningen redan är extremt stabil — hindrar att
 * en stor organisation blockerar UI-tråden i hundratals ms.
 */
function computeBootstrapCI() {
    const t0 = performance.now();
    const d = getData().filter(r => r.lon > 0);
    const kv = d.filter(r => r.kon.includes('kvinna')).map(r => r.lon);
    const ma = d.filter(r => r.kon === 'man' || r.kon === 'män').map(r => r.lon);
    if (kv.length < statGolv() || ma.length < statGolv()) { state.bootstrapCI = null; return; }

    // B=2000: med B=600 blir Monte Carlo-variabiliteten på CI-gränserna
    // ~±0,5 pp, vilket märks för gränsfalls-par. B=2000 är vedertagen standard för 95%-CI och
    // räknar i praktiken inom ~50-200 ms på alla typiska storlekar.
    const B = 2000;
    const ratios = new Array(B);
    // Quickselect-median (O(n)) — sortering ger O(B·n log n), flera sekunder
    // vid 20 000 rader. Identiskt resultat.
    const sortedMedian = _quickMedian;

    const kvN = kv.length, maN = ma.length;
    const rnd = _rngFor(kv, ma);   // seedad ur datat → reproducerbart KI
    for (let b = 0; b < B; b++) {
        const sKv = new Array(kvN);
        const sMa = new Array(maN);
        for (let i = 0; i < kvN; i++) sKv[i] = kv[(rnd() * kvN) | 0];
        for (let i = 0; i < maN; i++) sMa[i] = ma[(rnd() * maN) | 0];
        const mKv = sortedMedian(sKv);
        const mMa = sortedMedian(sMa);
        ratios[b] = mMa > 0 ? mKv / mMa : 1;
    }
    ratios.sort((a, b) => a - b);
    const lo = ratios[Math.floor(B * 0.025)];
    const hi = ratios[Math.floor(B * 0.975)];
    const point = Stat.median(kv) / Stat.median(ma);

    state.bootstrapCI = {
        ratio:    { point, lo, hi },
        gapPct:   { point: (1 - point) * 100, lo: (1 - hi) * 100, hi: (1 - lo) * 100 },
        elapsed:  performance.now() - t0,
        B
    };
}

/**
 * Formaterar bootstrap-CI som textsuffix för punktestimat.
 * Returnerar t.ex. " [95 % KI: 3,1%–6,4%]" eller tom sträng om CI saknas.
 * @param {{lo:number, hi:number}} ci
 * @param {number} [decimals=1]
 */
function fmtCI(ci, decimals = 1) {
    if (!ci || !isFinite(ci.lo) || !isFinite(ci.hi)) return '';
    const f = n => n.toFixed(decimals).replace('.', ',');
    return ` <span class="ci-bracket" title="95% bootstrap-konfidensintervall (B=${state.bootstrapCI?.B || 2000})">[95 % KI: ${f(ci.lo)}%–${f(ci.hi)}%]</span>`;
}

// ---- #9 Power-analys: minsta detekterbara effektstorlek ----
/**
 * Beräknar minsta detekterbara lönegap (kr-procent) för regression β_kön
 * vid 80% power, α=0.05. Använder klassisk formel:
 *
 *     MDE_logβ ≈ (z_{1-α/2} + z_{1-power}) · σ_log · √(1/n_kv + 1/n_ma)
 *              ≈ 2.802 · σ_log · √(1/n_kv + 1/n_ma)
 *
 * där σ_log är spridningen i log(lön) INOM grupp: den poolade standardavvikelsen av
 * residualerna log(lön) − log(gruppens median per kön) över alla yrkesgrupper inom BAS
 * med minst statGolv() av varje kön (samma idé som trattdiagrammets σ i Lika arbete,
 * _laTrattUnderlagRakna). Spridningen över hela urvalet duger inte: den rymmer
 * skillnaderna mellan BAS-intervallen och överskattar därmed spridningen inom en grupp,
 * så att MDE per grupp blev för stor. Är underlaget för litet (inga grupper når golvet,
 * eller färre än MDE_SIGMA_MIN_RESIDUALER residualer) faller σ tillbaka på hela urvalet.
 *
 * @returns {null | {n:number, nKv:number, nMa:number, mdePct:number, sigma:number, sigmaKalla:'inomGrupp'|'helaUrvalet',
 *                   sigmaHela:number, sigmaGrupper:number, balanced:boolean}}
 */
const MDE_SIGMA_MIN_RESIDUALER = 20;
function computePowerAnalysis() {
    const d = getData().filter(r => r.lon > 0);
    if (d.length < 10) return null;
    const arKv = r => r.kon.includes('kvinna'), arMa = r => r.kon === 'man' || r.kon === 'män';
    const kv = d.filter(arKv).map(r => r.lon);
    const ma = d.filter(arMa).map(r => r.lon);
    if (kv.length < 2 || ma.length < 2) return null;
    // SD av log(lön) över hela urvalet — reserven när underlaget per grupp är för litet
    const allLog = d.map(r => Math.log(r.lon));
    const meanLog = allLog.reduce((s, v) => s + v, 0) / allLog.length;
    const varLog  = allLog.reduce((s, v) => s + (v - meanLog) ** 2, 0) / (allLog.length - 1);
    const sigmaHela = Math.sqrt(varLog);
    const inom = _mdeSigmaInomGrupp(d, arKv, arMa, statGolv());
    const sigma = inom ? inom.sigma : sigmaHela;
    // Cohen-style MDE för diff-of-means på log-skala vid 80% power, α=0.05
    const Z = 2.802; // 1.96 (α/2 tvåsidig) + 0.842 (power 80%)
    const mdeLog = Z * sigma * Math.sqrt(1 / kv.length + 1 / ma.length);
    const mdePct = (Math.exp(mdeLog) - 1) * 100;
    const minN = Math.min(kv.length, ma.length);
    const maxN = Math.max(kv.length, ma.length);
    // Jämn könsfördelning enligt verktygets definition: båda könen ≥ 40% av totalen.
    const balanced = minN / (minN + maxN) >= 0.4;
    return { n: d.length, nKv: kv.length, nMa: ma.length, mdePct, sigma, sigmaKalla: inom ? 'inomGrupp' : 'helaUrvalet',
             sigmaHela, sigmaGrupper: inom ? inom.grupper : 0, balanced };
}
/**
 * Poolad standardavvikelse av residualerna log(lön) − log(gruppens median per kön) över alla yrkesgrupper inom
 * BAS med minst `golv` av varje kön. Frihetsgraderna är antalet residualer minus två medianer per grupp.
 * @returns {null | {sigma:number, grupper:number, residualer:number}} null när underlaget är för litet
 */
function _mdeSigmaInomGrupp(d, arKv, arMa, golv) {
    const perGrupp = new Map();
    for (const r of d) {
        const kv = arKv(r), ma = arMa(r);
        if (!kv && !ma) continue;
        const nyckel = `${r.yrke}|${r.bas}`;
        if (!perGrupp.has(nyckel)) perGrupp.set(nyckel, { kv: [], ma: [] });
        perGrupp.get(nyckel)[kv ? 'kv' : 'ma'].push(r.lon);
    }
    const grupper = [...perGrupp.values()].filter(g => g.kv.length >= golv && g.ma.length >= golv);
    if (!grupper.length) return null;
    let summa = 0, antal = 0;
    for (const g of grupper) {
        for (const [loner] of [[g.kv], [g.ma]]) {
            const logMed = Math.log(Stat.median(loner));
            for (const v of loner) { summa += (Math.log(v) - logMed) ** 2; antal++; }
        }
    }
    const df = antal - 2 * grupper.length;
    if (antal < MDE_SIGMA_MIN_RESIDUALER || df < 1) return null;
    const sigma = Math.sqrt(summa / df);
    return sigma > 0 ? { sigma, grupper: grupper.length, residualer: antal } : null;
}

// ---- Process-tracker: status för hela lagresan (kap. 3, §§ 8–14) ----
/**
 * Renderar ett kort på Översikt som visar var HR står i den JURIDISKA processen
 * (inte datauppladdningen — det är wizardens jobb): vilka lagsteg är klara, vilka
 * återstår. Varje steg härleds ur state, är klickbart till rätt flik, och tonen är
 * coachande (föreslår, dömer inte). Kortet ska synas ÄVEN utan inläst data — då
 * greetar det med steg 1 "börja här".
 *
 * Robusthet: varje steg-härledning körs i egen try/catch så ett fel i ett steg
 * inte fäller hela kortet. Länkarna använder `data-goto-tab` (delegerad lyssnare i
 * 03-hjalpfunktioner.js) — inga inline-onclick (hash-CSP, ADR-9).
 */
/** @param {{punkter?: any[]}} [val] punkter: Att göras lista när anroparen just byggt den (annars byggs den här) */
function renderProcessTracker({ punkter: givna } = {}) {
    const host = document.getElementById('process-tracker');
    if (!host) return;

    const hasData = (() => { try { return getData().length > 0; } catch (_e) { return false; } })();
    // `inget`: steget har inget att hantera i Att göra men är inte klart (alla kandidatpar har en grupp under tröskeln).
    const ICON = { klar: ikon('bock'), delvis: ikon('delvis'), ej: ikon('ruta'), manuell: ikon('streck'), inget: ikon('streck') };

    // safe(fn, fallback): kör härledningen skyddat; ett kast ger fallback-raden och rapporteras.
    const safe = (fn, fallback) => { try { const r = fn(); return r || fallback; } catch (e) { rapporteraFel('Processöversikten', e); return fallback; } };

    // Ett analyssteg är klart först när dess punkter i Att göra är hanterade — att analysen
    // har körts räcker inte (ADR-29). Listan byggs en gång för alla steg.
    const punkter = Array.isArray(givna) ? givna : (hasData ? safe(() => (typeof buildActionChecklist === 'function' ? buildActionChecklist() : []), []) : []);
    const klarmarkerade = state._actionChecklistDone || new Set();
    const hanterade = kategorier => _agHanterade(punkter, klarmarkerade, kategorier);   // src/lib/attgora.js

    const rows = [];

    // 1. Underlag inläst
    rows.push(hasData
        ? { n: 1, status: 'klar', title: '1. Underlag inläst', tab: 'dashboard', detail: `${getData().length} rader inlästa — allt nedan bygger på detta.` }
        : { n: 1, status: 'ej',   title: '1. Underlag inläst', tab: 'dashboard', detail: 'Börja här: ladda upp personalfilen (eller prova med demodata).' });

    // 2. § 8 Bestämmelser & praxis (kvalitativ bedömning per område)
    rows.push(safe(() => {
        const areas = (typeof _bes8Areas === 'function') ? _bes8Areas() : [];
        const total = areas.length || 6;
        const done = areas.filter(a => a && a.status).length;
        return {
            n: 2, tab: 'bestammelser', title: '2. Regler & praxis',
            status: done === 0 ? 'ej' : (done >= total ? 'klar' : 'delvis'),
            detail: `${done}/${total} granskningsområden bedömda. Går att påbörja innan data finns.`
        };
    }, { n: 2, tab: 'bestammelser', title: '2. Regler & praxis', status: 'ej', detail: 'Gå igenom de sex granskningsområdena — kan göras direkt.' }));

    // 3. § 9 Lika arbete (oförklarat gap + antal grupper att förklara/åtgärda)
    rows.push(safe(() => {
        if (!hasData) return { n: 3, tab: 'matrix', title: '3. Lika arbete — samma yrke', status: 'ej', detail: 'Kräver inläst underlag.' };
        const reg = (typeof runOLSRegression === 'function') ? runOLSRegression() : null;
        const ok = !!(reg && !reg.error);
        const { t, d } = hanterade(['Lika arbete', 'EU 2023/970']);
        return { n: 3, tab: 'matrix', title: '3. Lika arbete — samma yrke', ..._agStegLikaArbete({ regressionOk: ok, t, d }) };
    }, { n: 3, tab: 'matrix', title: '3. Lika arbete — samma yrke', status: 'ej', detail: 'Kräver inläst underlag.' }));

    // 4. § 3:10 Likvärdigt arbete (antal kandidatpar)
    rows.push(safe(() => {
        if (!hasData) return { n: 4, tab: 'likvardighet', title: '4. Likvärdigt arbete', status: 'ej', detail: 'Kräver inläst underlag.' };
        let lv = state.likvardighet ? state.likvardighet.result : null;   // återanvänd cache (wizarden fyller den)
        if (lv == null && typeof computeLikvardighetPairs === 'function') {
            lv = computeLikvardighetPairs();
            if (state.likvardighet) state.likvardighet.result = lv;
        }
        // Antalet står bredvid antalet hanterade punkter i Att göra, som utelämnar par med en grupp
        // under tröskeln — därför räknas de redovisade paren och de utelämnade nämns. Finns bara utelämnade
        // par säger steget det självt (tillståndet `inget`, knappen leder till fliken).
        const { par, utelamnade, not } = _parForRedovisning(lv && lv.pairs);
        const { t, d } = hanterade(['Likvärdigt arbete']);
        const steg = _agStegLikvardigt({ analys: !!lv, antalPar: par.length, utelamnade, k: kTroskel(), t, d });
        return { n: 4, tab: 'likvardighet', title: '4. Likvärdigt arbete', ...steg, detail: steg.detail + (not && steg.status !== 'inget' ? ' ' + not : '') };
    }, { n: 4, tab: 'likvardighet', title: '4. Likvärdigt arbete', status: 'ej', detail: 'Kräver inläst underlag.' }));

    // 5. § 3:11 Handlingsplan (avbockade åtgärdspunkter / totalt)
    rows.push(safe(() => {
        if (!hasData) return { n: 5, tab: 'handlingsplan', title: '5. Handlingsplan', status: 'ej', detail: 'Kräver inläst underlag.' };
        const items = punkter;
        const d = items.filter(it => klarmarkerade.has(it.id)).length;
        const t = items.length;
        return {
            n: 5, tab: 'handlingsplan', title: '5. Handlingsplan',
            status: t === 0 ? 'ej' : (d >= t ? 'klar' : (d > 0 ? 'delvis' : 'ej')),
            detail: t === 0
                ? 'Fyll i handlingsplanen på fliken (förifylls från prioriteringen).'
                : `${d}/${t} åtgärdspunkter hanterade i åtgärdslistan.`
        };
    }, { n: 5, tab: 'handlingsplan', title: '5. Handlingsplan', status: 'ej', detail: 'Kräver inläst underlag.' }));

    // 6. § 3:13 Samverkan — kan inte auto-härledas
    rows.push({ n: 6, tab: 'dokumentera', title: '6. Samverkan med facket', status: 'manuell', detail: 'Manuellt steg: samverka och dokumentera. Protokollet för gemensam lönebedömning finns under Dokumentera & exportera.' });

    // 7. Dokumentation — kan inte auto-härledas
    rows.push({ n: 7, tab: 'dokumentera', title: '7. Dokumentation', status: 'manuell', detail: 'Manuellt steg: ladda ner Word-utkastet under Dokumentera & exportera, komplettera de gula [HR fyller i]-fälten och spara som er rapport.' });

    // 8. § 3:11–13 Uppföljning. Verktyget stödjer EN kartläggning — uppföljningen
    // av handlingsplanen sker i arbetsgivarens egen process, som samverkan och
    // dokumentation ovan.
    rows.push({ n: 8, tab: 'dokumentera', title: '8. Uppföljning av handlingsplanen', status: 'manuell', detail: 'Manuellt steg: följ upp planens åtgärder i er egen process. Handlingsplanen exporteras under Dokumentera & exportera.' });

    const autoDone = rows.filter(r => r.status === 'klar').length;
    const autoTotal = rows.filter(r => r.status !== 'manuell').length;

    // Stegen grupperas under samma faser som menyn (en karta).
    const FASER = { 1: '1 · Underlag', 2: '2 · Kartlägg & analysera', 5: '3 · Åtgärda', 6: '5 · Dokumentera' };
    const rowsHtml = rows.map(r => `
        ${FASER[r.n] ? `<div class="ptrack-fas">${FASER[r.n]}</div>` : ''}
        <div class="ptrack-row">
            <span class="ptrack-status" data-status="${esc(r.status)}" aria-hidden="true">${ICON[r.status] || ikon('ruta')}</span>
            <div class="ptrack-body">
                <div class="fs-md fw-600">${esc(r.title)}</div>
                <div class="ptrack-detail">${esc(r.detail)}</div>
                <button type="button" class="ptrack-goto" data-goto-tab="${esc(r.tab)}">Gå till steget</button>
            </div>
        </div>`).join('');

    // Rubriknivå h3 (inte h2): kortet ligger i dashboard-flödet mellan KPI-korten
    // (h3) och datakvalitetspanelens h4:or — en h2 här skulle ge ett h2→h4-hopp som
    // axe-sviten flaggar (heading-order). h3 håller "öka med max ett".
    host.innerHTML = `
        <div class="card ptrack" role="region" aria-label="Lönekartläggningsprocessen">
            <h3>Lönekartläggningsprocessen — var står ni?</h3>
            <p class="ptrack-intro">
                Översikt över hela lönekartläggningen, steg för steg.
                Statusen härleds automatiskt ur ert arbete och <em>föreslår</em> nästa steg —
                den dömer inte. ${autoTotal ? `<strong>${autoDone}/${autoTotal}</strong> auto-härledda steg klara.` : ''}
            </p>
            ${rowsHtml}
        </div>`;
    _laNyckel('nyckel-ov-process', hasData && autoTotal ? `${autoDone} av ${autoTotal} steg klara` : '');
    // Processöversikten ritas vid start, vid varje inläsning och när en referens eller tröskeln ändras:
    // sidans läge följer med härifrån.
    ovRitaLage();
}

/**
 * Översikt efter inläsning. Före inläsning är sidan en uppladdningssida.
 * Efter inläsning krymper filerna till en rad, och sidan visar läget: nyckeltalen, kartan över organisationen,
 * lönekvartilerna och Att göra. Resten är avsnitt som fälls ut. Klassen `har-data` på panelen styr vad som visas
 * (style.css); `visa-filer` fäller ut uppladdningen igen.
 */
/** @type {boolean|null} */
let _ovHadeData = null;
// Kartan och kvartilerna är kopior av Struktur & rapportmåtts diagram och exporteras därifrån, inte två gånger
// (skälet `kopia` i 11-diagramexport.js).
markeraUtanExport(document.getElementById('ov-lage'), 'kopia');
function ovRitaLage() {
    const vy = /** @type {HTMLElement} */ (document.getElementById('view-dashboard'));
    if (!vy) return;
    const d = (() => { try { return getData(); } catch (_e) { return []; } })();
    const har = d.length > 0;
    vy.classList.toggle('har-data', har);
    if (typeof sokUppdatera === 'function') sokUppdatera();   // sökfältet i sidhuvudet finns bara när det finns grupper att söka i
    if (har !== _ovHadeData) {
        // Läget byter: processen är utfälld före inläsning och hopfälld efter, och uppladdningen fälls ihop.
        const proc = document.getElementById('avsnitt-ov-process');
        if (proc) /** @type {HTMLDetailsElement} */ (proc).open = !har;
        vy.classList.remove('visa-filer');
        _ovHadeData = har;
    }
    _ovRitaFilrad(har, d.length);
    const kvEl = document.getElementById('chart-ov-kvartiler'), kvNot = document.getElementById('ov-kvartiler-not');
    if (!har) {
        ['chart-ov-tradkarta', 'chart-ov-kvartiler'].forEach(id => { const el = document.getElementById(id); if (el && typeof rensaFigur === 'function') { rensaFigur(el); el.innerHTML = ''; } });
        if (kvNot) kvNot.textContent = '';
        return;
    }
    try {
        if (typeof renderStrukturTradkarta === 'function') renderStrukturTradkarta(d, 'chart-ov-tradkarta');
        // Samma villkor som i Struktur: utan könsuppdelning (ett kön under tröskeln) ritas inget diagram.
        const k = kTroskel(), q = _stQuartileDistribution(d, { k });
        const totKv = d.filter(r => r.kon && r.kon.includes('kvinna')).length;
        if (kvEl) {
            if (q.length && q.every(x => x.nKv != null && x.nMa != null && x.n > 0)) {
                ritaFigur(kvEl, _strukturKvartilFigur(q, 100 * totKv / d.length),
                    { exportAnteckning: `Andel kvinnor: ${_figTalformat(q[0].andelKv, 'pct')} i lägsta kvartilen, ${_figTalformat(q[q.length - 1].andelKv, 'pct')} i högsta` });
                if (kvNot) kvNot.textContent = '';
            } else {
                rensaFigur(kvEl); kvEl.innerHTML = '';
                if (kvNot) kvNot.textContent = _konUtelamnatNot();
            }
        }
    } catch (e) { rapporteraFel('Översikt: läget', e); }
}

/** Raden som ersätter uppladdningskorten efter inläsning: vad som är inläst, och knappen som visar korten igen. */
function _ovRitaFilrad(har, antal) {
    const rad = document.getElementById('ov-filrad'), vy = document.getElementById('view-dashboard');
    if (!rad) return;
    if (!har) { rad.textContent = ''; return; }
    const oppen = !!vy && vy.classList.contains('visa-filer');
    rad.innerHTML = `<span><strong>Lönefil:</strong> ${svTal(antal, 0)} personer</span>`
        + `<span><strong>Referens:</strong> ${esc(harReferens() ? referensNamn() : 'ingen inläst')}</span>`
        + `<span><strong>Jämförelsestatistik:</strong> ${state.statistik.length ? `${svTal(state.statistik.length, 0)} rader` : 'ingen inläst'}</span>`
        + kTroskelLank()
        + `<button type="button" id="btn-ov-filer" class="btn btn-secondary btn-sm" aria-expanded="${oppen}" aria-controls="upload-sektion">${oppen ? 'Dölj filer och inställningar' : 'Filer och inställningar'}</button>`;
}
document.addEventListener('click', e => {
    if (!/** @type {HTMLElement} */ (e.target).closest) return;
    const vy = /** @type {HTMLElement} */ (document.getElementById('view-dashboard'));
    if (!/** @type {HTMLElement} */ (e.target).closest('#btn-ov-filer')) return;
    vy.classList.toggle('visa-filer');
    _ovRitaFilrad(true, getData().length);
    document.getElementById('btn-ov-filer')?.focus();
});

/**
 * Beräknar MDE för en specifik undergrupp (t.ex. en yrkesgrupp eller BAS-rad).
 * Återanvänder σ ur computePowerAnalysis: spridningen i log-lön INOM grupp (poolad över
 * yrkesgrupperna inom BAS), inte över hela urvalet — den är stabil över grupper.
 *
 * @param {number} nKv - antal kvinnor i gruppen
 * @param {number} nMa - antal män i gruppen
 * @param {number} [sigmaLog] - σ för log(lön) (default: hämta från cache)
 * @returns {null | {mdePct:number, level:'good'|'fair'|'poor', tooSmall:boolean}}
 */
function computeGroupMDE(nKv, nMa, sigmaLog) {
    const sigma = sigmaLog || state.powerAnalysis?.sigma;
    if (!sigma || nKv < 2 || nMa < 2) return null;
    const Z = 2.802;
    const mdeLog = Z * sigma * Math.sqrt(1 / nKv + 1 / nMa);
    const mdePct = (Math.exp(mdeLog) - 1) * 100;
    const level = mdePct < 3 ? 'good' : mdePct < 7 ? 'fair' : 'poor';
    const tooSmall = nKv < 5 || nMa < 5;
    return { mdePct, level, tooSmall };
}

// ---- Dashboard stats ----
function updateDashboardStats() {
    const d   = getData();
    if (!d.length) return;
    const allAges = d.map(r => r.alder).filter(a => a && !isNaN(a));
    const medKv = Stat.median(d.filter(r => r.kon.includes('kvinna')).map(r => r.lon));
    const medMa = Stat.median(d.filter(r => r.kon === 'man' || r.kon === 'män').map(r => r.lon));
    /** @type {HTMLElement} */ (document.getElementById("stat-n")).textContent = String(d.length);
    const nKv = d.filter(r => r.kon.includes('kvinna')).length, nMa = d.filter(r => r.kon === 'man' || r.kon === 'män').length;
    const konEl = document.getElementById('stat-kon');
    if (konEl) konEl.textContent = `${nKv.toLocaleString('sv-SE')} / ${nMa.toLocaleString('sv-SE')}`;
    /** @type {HTMLElement} */ (document.getElementById("stat-age")).textContent = allAges.length ? svTal(allAges.reduce((a,b)=>a+b,0)/allAges.length, 1) : "–";
    const pgEl = document.getElementById("stat-paygap");
    if (pgEl) {
        const ratio = medMa > 0 ? (medKv / medMa) * 100 : null;
        if (ratio == null) {
            pgEl.textContent = "-";
        } else if (!_konFarRedovisas(nKv, nMa)) {
            // k-anonymitet (ADR-12): kvoten pekar ut de få i det mindre könet.
            pgEl.innerHTML = `–<div class="stat-tip">Visas inte: ett kön har färre än ${kTroskel()} personer.</div>`;
        } else {
            // Rå kvot för hela organisationen: EU-direktivets 5 %-gräns gäller per
            // kategori av arbetstagare, inte här — därför ingen hänvisning till den, och neutral färg: rågapet
            // är en utgångspunkt, inget fynd. Bedömningen görs per grupp i Lika arbete.
            const tipText = 'Rå skillnad för hela organisationen, före hänsyn till yrke, nivå och ålder. Se Lika arbete för skillnaden per grupp.';
            // Förklaringen står i verktygstipset; under talet står bara vad det är för tal (nyckeltalsraden är en rad hög).
            pgEl.innerHTML = svPct(ratio, 1) +
                `<div class="stat-tip" title="${esc(tipText)}">rå skillnad, innan yrke och nivå räknats bort</div>`;
        }
    }
}

/** Översikts delar, i ordning: det som inläsningen ritar och som exportgrinden måste kunna rita om (ADR-51). */
function renderOversiktDelar() {
    /** @type {any[]|undefined} */ let punkter;   // processöversikten läser Att göras punkter: byggs en gång
    /** @type {[string, () => void][]} */
    const delar = [['nyckeltal', () => updateDashboardStats()], ['kompliansöversikt', () => updateCompliance()],
        ['underlagets kvalitet', () => renderUnderlagetsKvalitet()], ['Att göra', () => { punkter = renderActionChecklist(); }],
        ['processöversikten', () => renderProcessTracker({ punkter })], ['extremvärden', () => renderOutliers()],
        ['inläsningsrapporten', () => renderDataValidationReport()]];   // Var uppstår löneskillnaden ritas av kompliansöversikten
    for (const [namn, fn] of delar) { try { fn(); } catch (e) { rapporteraFel(`Översikt (${namn})`, e); } }
    const ab = document.getElementById('snapshot-comparison');
    if (ab && ab.style.display !== 'none' && typeof renderSnapshotComparison === 'function') renderSnapshotComparison();
}

// ---- Populate BAS selects ----
function populateSelects() {
    const bas = getBasIntervals();
    ['bas-select-kon','bas-select-demo'].forEach(selId => {
        const sel = document.getElementById(selId);
        if (!sel) return;
        const prev = /** @type {HTMLInputElement} */ (sel).value;
        sel.innerHTML = "";
        // Båda flikarna får "Alla BAS" som första alternativ
        const allOpt = document.createElement("option");
        allOpt.value = "__ALLA__"; allOpt.textContent = "Alla BAS (hela urvalet)";
        sel.appendChild(allOpt);
        bas.forEach(b => {
            const opt = document.createElement("option");
            opt.value = b; opt.textContent = `BAS ${b}`;
            sel.appendChild(opt);
        });
        if (prev && [.../** @type {HTMLSelectElement} */ (sel).options].some(o => o.value === prev)) /** @type {HTMLInputElement} */ (sel).value = prev;
    });
}


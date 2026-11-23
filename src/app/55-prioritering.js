// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { aidAvYrke, sektorsnamn } from '../lib/aid.js';
import { talformat } from '../lib/figur.js';
import { installningsGrans } from '../lib/installningsgranser.js';
import { statistikFor } from '../lib/jamforelse.js';
import { personOrd } from '../lib/namn.js';
import { kostnadskurva, motiveringsgrunder, prioKonstanter, prioNyckeltal, prioritera } from '../lib/prioritering.js';
import { avrundaSymmetriskt } from '../lib/stat.js';
import { svKr, svPct, svPoPct, svTal } from '../lib/talformat.js';
import { adjektiv, stor as termStor } from '../lib/termer.js';
import { FARG } from './01-farger.js';
import { esc } from './01-html-och-tillganglighet.js';
import { tillampaDataStil } from './03-hjalpfunktioner.js';
import { ikon } from './03-ikoner.js';
import { byggStapelcell, byggGrundurval, flerKolumner, sattMetodik, tillampaFlerKolumner } from './05-tabeller-och-lankar.js';
import { kMaskerad, kInstalld, kTroskel, statGolv } from './06-k-troskel.js';
import { COST_DEFAULTS, PRIO_CONFIG_DEFAULTS, PRIO_WEIGHTS_DEFAULTS } from './07-standardinstallningar.js';
import { T } from './09-termer.js';
import { _rfKorta } from './10-diagramlayout.js';
import { rensaFigur, ritaFigur } from './10-diagramritare.js';
import { gapStatus, gapStatusNiva, PALETTE, URVAL } from './10-diagramtema.js';
import { markeringFor } from './11-markering.js';
import { hamtaData, policyFor, referensKortnamn, referensNamn, state } from './12-tillstand.js';
import { computeGroupMDE, styrkaGallande } from './13-oversikt.js';
import { _laggTillMetodblad, _visaExportvarning, tabellTillBok } from './22-exporthjalpare.js';
import { medExportLage, visningNy } from './23-exportgrind.js';
import { _evidenceForPrioItem, _openEvidenceModal } from './27-berakningsbevis.js';
import { ritaFlik } from './31-navigering.js';
import { _laNyckel } from './41-lika-arbete.js';

// ---- Prioriteringsanalys ----
// Samlar yrkesgrupper × BAS, beräknar avvikelse mot vald referens
// och rangordnar efter ett sammansatt prioriteringsindex.
/**
 * Bygger prioriteringslistan: beräknar avvikelse mot referens, kostnad för utjämning
 * (inkl. PO-påslag och beräkningsperiod), läget mot referensen (Börja här/Under referens, liten grupp/Nära referens/Över referens),
 * jämställdhetsindex, och en sammanvägd prio-poäng (avvikelse·volym·jämställdhet).
 * Driver "Prioritering"-tabben + EU-kartläggningens åtgärdslista.
 * @param {string} reference - Referens-mätsticka: 'stallningstagande'|'statistik'
 * @returns {Array<Object>} Lista av prio-items, sorterade på score desc.
 */
export function computePrioritization(reference) {
    // Modellen (grupperingen, indexet, k-regeln) ligger i src/lib/prioritering.js (ADR-8).
    // Här översätts bara state till referensFor och parametrar.
    return prioritera(hamtaData(), {
        referensFor: (aid, bas) => {
            if (reference === 'stallningstagande') {
                const pol = policyFor(aid, bas);
                return pol && pol.med ? { median: pol.med, kalla: referensKortnamn() } : null;
            }
            // 'statistik'
            const sr = statistikFor(state.statistik, aid, bas)?.rad;
            return sr && sr.median > 0 ? { median: sr.median, kalla: 'jämförelsestatistiken' } : null;
        },
        kTroskel: kTroskel(),
        prioConfig: state.prioConfig,
        prioWeights: state.prioWeights,
        costSettings: state.costSettings,
        bristAids: state.bristAids
    });
}

// ---- #13 AI-fri "förslag till motivering"-engine ----
/**
 * Genererar regelbaserade förslag på testbara hypoteser/sakliga skäl för
 * en prio-rad. INGEN AI/LLM — bara deterministiska regler över datan.
 * Förslagen är frågor HR själv borde ställa, inte färdiga motiveringar.
 *
 * Reglerna och deras ordning: motiveringsgrunder i src/lib/prioritering.js.
 *
 * @param {Object} item - Prio-item med _rows.
 * @returns {Array<{type:'warn'|'info'|'ok'|'flag', text:string}>}
 */
export function generateMotivationSuggestions(item) {
    return motiveringsgrunder(item, {
        kInstalld: kInstalld(), kTroskel: kTroskel(),
        mdePct: styrkaGallande()?.mdePct, naraGrans: state.prioConfig.bevakaThreshold
    }).map(g => ({ type: g.type, text: _motiveringText(g) }));
}

// Texten till en grund ur motiveringsgrunder; talen kommer ur lib och formateras här.
function _motiveringText(g) {
    switch (g.kod) {
        case 'underlag': return `Underlaget är litet (${g.kvN} kvinnor / ${g.maN} män; minsta gruppstorlek ${g.k}). Skillnaden kan inte säkerställas statistiskt — ett tips är att överväga att slå ihop med en näraliggande BAS-grupp eller titta på individerna var för sig.`;
        case 'styrka': return `Skillnaden (${svPct(g.diffPct, 1)}) ligger under detektionströskeln (~${svPct(g.mdePct, 1)}). Det innebär att skillnaden är så liten att den inte med säkerhet kan skiljas från slumpmässiga variationer.`;
        case 'alder': return `${g.medelMa > g.medelKv ? 'Männen' : 'Kvinnorna'} är i snitt <strong>${svTal(Math.abs(g.medelMa - g.medelKv), 1)} år äldre</strong> än motparten i denna grupp (${svTal(g.medelMa, 0)} mot ${svTal(g.medelKv, 0)}). Stäm av om åldersskillnaden förklarar en del av löneskillnaden. Erfarenhet och tid i yrket är ofta sakliga skäl för löneskillnader.`;
        case 'kvintil': return `<strong>Mönster med glastak eller klibbigt golv:</strong> ${svPct((g.andelKv*100), 0)} av kvinnorna i denna grupp ligger i den lägsta lönekvintilen, jämfört med ${svPct((g.andelMa*100), 0)} av männen. Det kan vara värdefullt att titta närmare på hur karriärvägar, befordringar och lönesättningsbeslut ser ut för gruppen.`;
        case 'brist': return 'Markerat som <strong>bristyrke</strong>. Marknadsläge (rekryteringssvårighet) kan vara ett sakligt skäl — dokumentera gärna marknadsläget med stöd av extern statistik (t.ex. från SCB lönestrukturstatistik).';
        case 'snabbVinst': { const K = prioKonstanter(); return `<strong>Snabb vinst:</strong> gruppen ligger mer än ${svPct(K.SNABB_VINST_AVVIKELSE, 0)} under referensen, och kostnaden per person är under ${svKr(K.SNABB_VINST_KR)} per månad (${g.n} personer). Lämplig för pilotåtgärd för att visa förändringsvilja.`; }
        case 'over': return `Ligger ${svPct(g.diffPct, 1)} över referensen. Dokumentera gärna varför.`;
        default: return `Gruppens median ligger inom ±${svTal(g.nara, g.nara % 1 ? 1 : 0)} % av referensen.`;   // 'nara'
    }
}

// Prioriteringens egna ord för läget mot referensen (A5, ADR-62). De delar inte namn med uppmärksamhetstrappan för
// skillnaden mellan kvinnor och män (Värt att granska, Följ upp, Balanserat): Prioriteringen mäter löneläget mot er
// referens, inte lönekartläggningens könsskillnader. Statusvärdena i src/lib/prioritering.js är oförändrade; «Nära
// referens» har två färger, under uppföljningsgränsen och däröver. «Under referens, liten grupp» säger att Börja här
// är samma läge i en större grupp; nyckeltalen räknar statusarna och heter som dem.
export const PRIO_STATUS_INFO = {
    akut:      { label: 'Börja här',     icon: ikon('nal'), color: FARG.granska, bg: FARG.granskaBg, klass: 'bricka-granska' },
    atgard:    { label: 'Under referens, liten grupp', icon: ikon('sok'), color: FARG.granska, bg: FARG.granskaBg, klass: 'bricka-granska' },
    bevaka:    { label: 'Nära referens, under', icon: ikon('oga'), color: FARG.varning, bg: FARG.varningBg, klass: 'bricka-varning' },
    ok:        { label: 'Nära referens', icon: ikon('bock'),  color: FARG.ok, bg: FARG.okBg, klass: 'bricka-ok' },
    analysera: { label: 'Över referens', icon: ikon('info'), color: FARG.info, bg: FARG.infoBg, klass: 'bricka-info' }
};
/** En gräns ur state.prioConfig som text utan tecken, med decimaler bara när gränsen har några («5 %», «2,5 %»). */
export function _prioGrans(v) {
    const a = Math.abs(v);
    return svPct(a, Number.isInteger(a) ? 0 : Number.isInteger(a * 10) ? 1 : 2);
}
/**
 * Vad statusen betyder, med gränserna ur inställningen: undertexten under nyckeltalen. Bara för de statusar som har
 * ett nyckeltal (Börja här, Under referens, liten grupp och Över referens).
 * @param {'akut'|'atgard'|'analysera'} status
 * @param {{atgardThreshold:number, akutMinN:number, analyseraThreshold:number}} cfg
 */
function _prioStatusVillkor(status, cfg) {
    if (status === 'akut') return `mer än ${_prioGrans(cfg.atgardThreshold)} under, minst ${cfg.akutMinN} personer`;
    if (status === 'atgard') return `mer än ${_prioGrans(cfg.atgardThreshold)} under, färre än ${cfg.akutMinN} personer`;
    return `mer än ${_prioGrans(cfg.analyseraThreshold)} över`;
}
/**
 * Uppmärksamhetstrappans bricka för kolumnen Skillnad kön (ADR-71). Prioriteringen prövar inte skillnaden mot
 * slumpen, så brickan sätts efter storleken som i Utforska (högst Följ upp); under statGolv() per kön, eller utan
 * jämförelse per kön, står Går ej att bedöma. Brickan står bara på skärmen: exporten bär talet.
 * @param {{gapPct:number|null, kvN:number, maN:number}} i
 */
function _prioKonStatus(i) {
    const golv = statGolv();
    const gap = i.gapPct;
    const ej = typeof gap !== 'number' || !isFinite(gap) || !(i.kvN >= golv && i.maN >= golv);
    const st = typeof gap !== 'number' || ej ? gapStatusNiva('ejbedomd') : gapStatus(Math.abs(gap), false);
    const tips = ej ? `Går ej att bedöma: ett kön har färre än ${golv} ${personOrd(golv)}, för få för att pröva skillnaden`
        : st.niva === 'folj' ? 'Skillnaden är minst 3 % (verktygets storleksgräns). Prioriteringen prövar inte skillnaden mot slumpen; prövningen finns i Lika arbete.'
        : 'Skillnaden är under 3 %. Prioriteringen prövar inte skillnaden mot slumpen; prövningen finns i Lika arbete.';
    return `<span class="la-status ar-${st.farg} prio-konstatus" data-niva="${st.niva}" data-export-text="" title="${esc(tips)}">${ikon(st.ikon)}${esc(st.serie)}</span>`;
}
/** PO-raden under nyckeltalet: standardvärdet säger att det är ett antagande, ett eget värde bara var det ändras. */
function _prioPoText() {
    const po = state.costSettings.poPct;
    return po === COST_DEFAULTS.poPct
        ? `inkl. PO-påslag ${svPoPct(po)} (ett standardantagande; sätt organisationens eget under Inställningar)`
        : `inkl. PO-påslag ${svPoPct(po)} (ändras under Inställningar)`;
}

export function _selectedPrioReference() {
    const r = document.querySelector('input[name="prio-ref"]:checked');
    return r ? /** @type {HTMLInputElement} */ (r).value : 'stallningstagande';
}

function _selectedPrioLabelMode() {
    const el = document.getElementById('prio-label-mode');
    return el ? /** @type {HTMLInputElement} */ (el).value : 'topp10';
}

function _makePrioLabel(item, rank, mode) {
    if (mode === 'ingen') return '';
    const isTop10 = rank <= 10;
    const isAkut  = item.status === 'akut';
    // AID + etikett: visa hela yrket (AID + benämning) men trunkerat för läsbarhet
    const yrkeShort = item.yrke.length > 28 ? item.yrke.substring(0, 27) + '…' : item.yrke;
    const fullLabel = `${yrkeShort}·${item.bas}`;
    let show = false;
    if (mode === 'alla')         show = true;
    else if (mode === 'topp10')  show = isTop10;
    else if (mode === 'akuta')   show = isAkut || isTop10;
    if (!show) return '';
    return isTop10 ? `#${rank} ${fullLabel}` : fullLabel;
}

// Avrunda kostnader till "snygga" referensvärden (10k, 25k, 50k, 100k, 250k, 500k, 1M, ...)
function _niceCostLevels(maxCost) {
    if (!maxCost || maxCost <= 0) return [10000, 50000, 100000];
    const log10 = Math.floor(Math.log10(maxCost));
    const base  = Math.pow(10, log10);
    // Tre nivåer: 10%, 30%, 100% av size cap (rough)
    const cap = base * Math.ceil(maxCost / base);
    return [Math.round(cap * 0.1), Math.round(cap * 0.3), Math.round(cap)];
}
// Kostnaden i kort form, i nyckeltalen, rutan Total och staplarnas etiketter: "386 Mkr", "4,2 Mkr", "950 tkr".
function _fmtCost(kr) {
    if (kr >= 1e6) return svTal(kr/1e6, kr >= 1e7 ? 0 : 1) + '\u00a0Mkr';
    if (kr >= 1e3) return svTal(kr/1e3, 0) + '\u00a0tkr';
    return svKr(kr);
}

// Kolumnerna som prioriteringslistans grundvy gömmer bakom Fler kolumner (data-kol i src/index.html).
// Median och Referens göms också: utan dem ryms grundvyn vid 1280 px med menyn utfälld, och Avvikelse % säger hur de
// förhåller sig. Båda står i beviset (förstoringsglaset), liksom Kv/Mä, avvikelsen i kronor, kostnaden per person och bristyrket.
const PRIO_DOLDA_KOLUMNER = ['kvma', 'median', 'referens', 'avvikelsekr', 'kostnadpers', 'brist'];
export function renderPrioritering() {
    const ref = _selectedPrioReference();
    const empty   = document.getElementById('prio-empty');
    const content = document.getElementById('prio-content');
    if (!empty || !content) return;

    const refNamnEl = document.getElementById('prio-ref-policy-namn');
    if (refNamnEl) refNamnEl.textContent = referensKortnamn();
    // Saknas referensdata?
    const hasRefData = ref === 'stallningstagande' ? state.policy.length > 0 : state.statistik.length > 0;
    if (!hasRefData) {
        empty.style.display = 'block';
        content.style.display = 'none';
        const text = document.getElementById('prio-empty-text');
        if (text) text.textContent = ref === 'stallningstagande'
            ? 'Det finns inget ställningstagande att jämföra med, och verktyget kan därför inte rangordna grupperna. Läs in organisationens lönepolitiska ställningstagande eller organisationspaketet i Filer och kvalitet.'
            : 'Det finns ingen jämförelsestatistik att jämföra med, och verktyget kan därför inte rangordna grupperna. Läs in jämförelsestatistiken eller organisationspaketet i Filer och kvalitet.';
        return;
    }
    empty.style.display = 'none';
    content.style.display = 'block';

    const items = computePrioritization(ref);
    if (!items.length) {
        content.innerHTML = `<p class="farg-dampad pad-32 ta-mitt">${termStor(adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.enhet))} ${T.enhet.en} har matchande referens i den valda jämförelsen. Kontrollera att <code>${ref === 'stallningstagande' ? T.niva.bfl : T.kod.bfl}</code> i lönefilen matchar jämförelsefilen.</p>`;
        return;
    }

    // Sammanfattningsstatistik
    // Nyckeltalen räknar statusarna, som tabellens kolumn Status (samma gränser ur inställningen).
    const { akut: akutCount, atgard: underCount, analysera: overCount, totalKostnad: totalCost } = prioNyckeltal(items);
    const fmt = new Intl.NumberFormat('sv-SE');
    const fmtMkr = _fmtCost(totalCost);
    /** @type {HTMLElement} */ (document.getElementById('prio-stat-akut')).textContent  = String(akutCount);
    /** @type {HTMLElement} */ (document.getElementById('prio-stat-under')).textContent = String(underCount);
    /** @type {HTMLElement} */ (document.getElementById('prio-stat-over')).textContent  = String(overCount);
    /** @type {HTMLElement} */ (document.getElementById('prio-stat-cost')).textContent  = String(fmtMkr);
    for (const [id, status] of /** @type {const} */ ([['prio-stat-akut-not', 'akut'], ['prio-stat-under-not', 'atgard'], ['prio-stat-over-not', 'analysera']])) {
        const el = document.getElementById(id);
        if (el) el.textContent = _prioStatusVillkor(status, state.prioConfig);
    }
    // Avsnittens nyckeltal (ADR-41): samma tal som rutorna ovanför.
    _laNyckel('nyckel-pr-lista', `${items.length} ${items.length === 1 ? 'grupp' : 'grupper'}${akutCount ? ` · ${akutCount} att börja med` : ''}`, akutCount > 0);
    _laNyckel('nyckel-pr-kostnad', totalCost > 0 ? fmtMkr : '');
    // Trösklarna och viktningen ställs in i Inställningar; fliken säger bara om de är ändrade.
    const installningarRad = document.getElementById('pr-installningar-rad');
    if (installningarRad) {
        const anpassad = JSON.stringify(state.prioConfig) !== JSON.stringify(PRIO_CONFIG_DEFAULTS);
        installningarRad.innerHTML = `Trösklar och viktning: ${anpassad ? 'anpassade värden' : 'standardvärden'} <button type="button" class="ov-filrad-lank" data-oppna-installningar="prio-cfg-atgard">Ändra</button>`;
    }
    const costPerEl = document.getElementById('prio-stat-cost-period');
    if (costPerEl) costPerEl.textContent = `${state.costSettings.months} månader, inkl. PO-påslag ${svPoPct(state.costSettings.poPct)}`;
    const costPoEl = document.getElementById('prio-stat-cost-po');
    if (costPoEl) costPoEl.textContent = `Räknat på ${state.costSettings.months} månader, ${_prioPoText()}.`;

    // Sätt rang per item (matchar tabellen)
    items.forEach((it, idx) => { it.rank = idx + 1; });

    // Pareto-kurva: kumulativ kostnadsfördelning
    // Kumulativ procent, och antalet grupper som når 50 % och 80 % (kostnadskurva, src/lib/prioritering.js)
    const kurva = kostnadskurva(items, { max: 40, visas: PRIO_KOSTNAD_MAX });
    const { total: totalParetoCost, visade, kumPct: cumPct, n50, n80 } = kurva;
    const paretoEl = document.getElementById('chart-prio-pareto');
    const paretoSummary = document.getElementById('prio-pareto-summary');
    if (paretoEl && kurva.grupper.length > 0 && totalParetoCost > 0) {
        ritaFigur(paretoEl, _prioKostnadFigur(visade, cumPct));
        { let not = document.getElementById('prio-kostnad-not');
          if (!not) { not = document.createElement('p'); not.id = 'prio-kostnad-not'; not.className = 'diagramkort-not'; (paretoEl.closest('.chart-export-host') || paretoEl).insertAdjacentElement('afterend', not); }
          not.textContent = _prioKostnadNot(kurva); }
        if (paretoSummary) {
            paretoSummary.innerHTML = `
                <div class="farg-primary fw-700 marg-b-4">Total: ${_fmtCost(totalParetoCost)}</div>
                <div class="text-dampad-xs marg-b-6">${state.costSettings.months} månader × PO-påslag ${svPoPct(state.costSettings.poPct)}</div>
                <div>Topp <strong>${n50}</strong> grupper = 50%</div>
                <div>Topp <strong>${n80}</strong> grupper = 80%</div>
                <div class="finstilt">Alla under-betalda grupper sammanställda. Fokus på topp 80%-gränsen ger maximal kostnadseffekt.</div>
            `;
        }
    } else if (paretoEl) {
        rensaFigur(paretoEl);
        paretoEl.innerHTML = '<div class="farg-dampad pad-32 ta-mitt">Inga grupper under referensen — kurvan visas inte.</div>';
        if (paretoSummary) paretoSummary.innerHTML = '';
    }

    // Bubbeldiagram: avvikelse mot referensen (x) mot gruppens storlek (y, log), med kostnaden som bubblans yta.
    const refLabel = ref === 'stallningstagande' ? referensNamn() : 'jämförelsestatistiken';
    ritaFigur('chart-prio-matrix', _prioMatrisFigur(items, _selectedPrioLabelMode(), refLabel, state.prioConfig), { hojd: 520 });

    // Uppdatera storlekslegenden under grafen
    const sizeMax = Math.max(...items.map(i => Math.max(i.annualGapTotal, i.annualOverTotal, 1)));
    const levels = _niceCostLevels(sizeMax);
    const s1 = document.getElementById('prio-legend-s1');
    const s2 = document.getElementById('prio-legend-s2');
    const s3 = document.getElementById('prio-legend-s3');
    if (s1) s1.textContent = _fmtCost(levels[0]);
    if (s2) s2.textContent = _fmtCost(levels[1]);
    if (s3) s3.textContent = _fmtCost(levels[2]) + '+';

    // Audit
    const baseP = byggGrundurval();
    // Räkna grupper utan referens
    const dForCount = hamtaData();
    let smallCount = 0, noRefCount = 0;
    const groupCheck = {};
    dForCount.forEach(r => {
        const aid = aidAvYrke(r.yrke);
        const k = `${aid}|${r.bas}`;   // samma grupper som prioritera (src/lib/prioritering.js)
        if (!groupCheck[k]) groupCheck[k] = { n: 0, aid, bas: r.bas };
        groupCheck[k].n++;
    });
    Object.values(groupCheck).forEach(g => {
        if (kMaskerad(g.n)) { smallCount++; return; }
        if (ref === 'stallningstagande') {
            const pol = policyFor(g.aid, g.bas);
            if (!pol || !pol.med) noRefCount++;
        } else {
            const sr = statistikFor(state.statistik, g.aid, g.bas)?.rad;
            if (!sr) noRefCount++;
        }
    });
    sattMetodik('prioritering', {
        title: 'Prioriteringsanalys',
        ...baseP,
        usedInAnalysis: items.length,
        analysisExclusions: [
            ...(smallCount > 0 ? [[`${termStor(T.enhet.fl)} i ${T.niva.en} för små (minsta gruppstorlek, n&lt;${kTroskel()})`, smallCount]] : []),
            ...(noRefCount > 0 ? [[`${termStor(T.enhet.fl)} i ${T.niva.en} utan matchning i ${ref === 'stallningstagande' ? referensNamn() : 'jämförelsestatistiken'}`, noRefCount]] : [])
        ],
        formler: [
            ['Avvikelse %', '<code>(organisationens median / referensens median) − 1</code> i %'],
            ['Kostnad att nå referensen', `<code>|avvikelse kr/mån| × ${state.costSettings.months} mån × (1 + ${svPoPct(state.costSettings.poPct)}/100) × antal personer</code> (endast om under referens, inkl. PO-påslag)`],
            ['Prioriteringsindex', `<code>riktningsvikt × (avvikelse·${state.prioWeights.avvikelse}% + volym·${state.prioWeights.volym}% + jämställdhet·${state.prioWeights.jamstalldhet}%)</code>, skala 0-100`],
            ['Riktningsvikt', `${prioKonstanter().RIKTNING_UNDER.toFixed(1)} om under referens, ${prioKonstanter().RIKTNING_OVER.toFixed(1)} om över (under-betalning vägs tyngre)`],
            ['Läge mot referensen', `Läget sätts efter avvikelsen mot referensen: <br>• Börja här: under ${state.prioConfig.atgardThreshold} % och minst ${state.prioConfig.akutMinN} personer <br>• Under referens, liten grupp: under ${state.prioConfig.atgardThreshold} % och färre än ${state.prioConfig.akutMinN} personer <br>• Nära referens, under: under ${state.prioConfig.bevakaThreshold} % <br>• Över referens: över +${state.prioConfig.analyseraThreshold} % <br>• Nära referens: däremellan`]
        ],
        notes: [
            `Aktuell referens: <strong>${ref === 'stallningstagande' ? esc(referensNamn()) + ' (per BAS)' : 'jämförelsestatistiken (per AID)'}</strong>`,
            ...(JSON.stringify(state.prioConfig) !== JSON.stringify(PRIO_CONFIG_DEFAULTS) ? [`<strong>${ikon('kugghjul')} Anpassad konfiguration aktiv</strong> – tröskelvärdena har justerats från standardvärdena (Börja här: −5 % och minst 10 personer, Nära referens, under: −2 %, Över referens: +5 %)`] : []),
            'Tabellen visar de 30 högst prioriterade grupperna',
            'Bubblornas storlek visar kostnaden för perioden, den vågräta axeln avvikelsen och den lodräta antalet personer (logaritmisk skala)'
        ]
    });

    // Tabell – topp 30 (med filter)
    const tbody = /** @type {HTMLElement} */ (document.querySelector('#prio-table tbody'));
    tbody.innerHTML = '';
    const filterQuickwin = /** @type {HTMLInputElement} */ (document.getElementById('prio-filter-quickwin'))?.checked;
    const filterBrist    = /** @type {HTMLInputElement} */ (document.getElementById('prio-filter-brist'))?.checked;
    const filteredItems = items.filter(i =>
        (!filterQuickwin || i.isQuickWin) &&
        (!filterBrist    || i.isBrist)
    );
    const top = filteredItems.slice(0, 30);
    top.forEach((i, radIdx) => {
        const tr = document.createElement('tr');
        const statusInfo = PRIO_STATUS_INFO[i.status];
        const sgnKr  = i.diffKr  >= 0 ? '+' : '';
        const gapBar = byggStapelcell(i.gapPct, 15);
        const diffBar = byggStapelcell(i.diffPct, 25);
        const costTxt = i.annualGapTotal > 0 ? svKr(i.annualGapTotal) : '–';
        const costSort = i.annualGapTotal > 0 ? i.annualGapTotal : 0;
        const costPerPersonTxt = i.costPerPerson > 0 ? fmt.format(Math.round(i.costPerPerson)) : '–';
        const quickwinBadge = i.isQuickWin ? ' <span title="Snabb vinst" class="hjalpmarke hjalp-markor">' + ikon('blixt', 14) + '</span>' : '';
        const bristBadge    = i.isBrist    ? ' <span title="Bristyrke" class="hjalpmarke hjalp-markor">' + ikon('statusVarning', 14) + '</span>' : '';
        // #2 Power-varning per grupp: visa ⚠️ när gruppens MDE > observerad avvikelse
        // eller när någon köns-cell har < 5 personer.
        const groupMDE = computeGroupMDE(i.kvN, i.maN);
        const lowPower = groupMDE && (groupMDE.tooSmall || groupMDE.mdePct > Math.abs(i.diffPct));
        const powerBadge = lowPower
            ? ` <span title="Låg statistisk styrka — gruppens minsta detekterbara effekt ≈ ${svPct(groupMDE.mdePct, 1)}, ${groupMDE.tooSmall ? 'och underlaget per kön är litet (<5)' : 'större än observerad avvikelse'}. Tolka resultatet med försiktighet." class="farg-varning hjalpmarke fs-0_92em hjalp-markor">${ikon('statusVarning', 14)}</span>`
            : '';
        const rowKey = `${i.aid}|${i.bas}`;
        // #13 Förslag-knapp: suggestionerna beräknas vid expand, inte i förväg
        const suggestionBtn = i._rows && i._rows.length
            ? `<button class="btn-suggest" data-row-key="${esc(rowKey)}" type="button" title="Visa förslag på sakliga skäl-hypoteser" aria-label="Visa motiveringsförslag för ${esc(i.yrke)}" aria-expanded="false">Motiveringsförslag</button>`
            : '';
        // Radens knappar: Visa beräkningen står kvar som ikon (princip 3); de tre andra ligger i menyn Mer, som är
        // exportmenyns mönster (11-diagramexport.js: Escape och Tab ut stänger, fokus tillbaka till knappen).
        // Menyvalens text är en del av deras tillgängliga namn, som är desamma som när de var ikoner.
        const merId = `prio-mer-${radIdx + 1}`;
        const merMeny = `<div class="chart-export tabell-export prio-mer">`
            + `<button type="button" class="chart-export-btn" aria-expanded="false" aria-controls="${merId}" aria-label="Mer om ${esc(i.yrke)}">Mer</button>`
            + `<div class="chart-export-meny" id="${merId}" hidden>`
            + `<button type="button" class="row-cross-link" data-target="rapport" data-yrke="${esc(i.yrke)}" data-bas="${esc(i.bas)}" title="Öppna i Löneöversikten" aria-label="Öppna ${esc(i.yrke)} i Löneöversikten">Löneöversikten</button>`
            + suggestionBtn
            + `<button type="button" data-open-dossier="${esc(i.aid)}|${esc(i.bas)}" title="Öppna gruppdossiern — allt om denna grupp på en sida" aria-label="Öppna gruppdossier för ${esc(i.yrke)}">Gruppdossier</button>`
            + '</div></div>';
        tr.innerHTML = `
            <td class="sticky-col-1" data-sort-value="${i.priorityIndex}"><div class="rund-12 inline-block fs-sm fw-700 min-bredd-36 pad-3-8 ta-mitt ${i.priorityIndex>60?'bricka-kritisk':i.priorityIndex>40?'bricka-varning':'bricka-neutral'}">${svTal(i.priorityIndex, 0)}</div></td>
            <th scope="row" class="sticky-col-2 ram-b-1-kant fs-md fw-normal ta-vanster">${esc(i.yrke)}${quickwinBadge}${bristBadge}${powerBadge}</th>
            <td>${esc(i.bas)}</td>
            <td class="t-mitt" data-sort-value="${i.priorityIndex}"><span class="rund-12 inline-block fs-xs fw-600 pad-3-10 ${statusInfo.klass}">${statusInfo.icon ? statusInfo.icon + ' ' : ''}${statusInfo.label}</span></td>
            <td class="t-hoger">${i.n}</td>
            <td class="t-mitt">${i.kvN}/${i.maN}</td>
            <td class="t-hoger" data-sort-value="${i.median}">${fmt.format(Math.round(i.median))}</td>
            <td class="farg-dampad ta-hoger" data-sort-value="${i.refMedian}">${fmt.format(Math.round(i.refMedian))}</td>
            <td class="t-hoger">${diffBar}</td>
            <td class="t-hoger${i.diffKr < 0 ? ' f-kritisk' : ''}" data-sort-value="${i.diffKr}">${sgnKr}${fmt.format(avrundaSymmetriskt(i.diffKr))}</td>
            <td class="t-hoger">${gapBar}${_prioKonStatus(i)}</td>
            <td class="t-hoger${i.costPerPerson > 0 ? ' f-kritisk' : ''}" data-sort-value="${i.costPerPerson}">${costPerPersonTxt}</td>
            <td class="fw-600 ta-hoger" data-sort-value="${costSort}">${costTxt}</td>
            <td class="t-mitt">
                <input type="checkbox" class="brist-toggle" data-aid="${esc(i.aid)}" ${i.isBrist ? 'checked' : ''} aria-label="Markera ${esc(i.yrke)} som bristyrke">
            </td>
            <td class="ta-mitt prio-detalj"><div class="prio-detalj-knappar">
                <button class="btn-evidence" data-prio-row="1" type="button" title="Visa beräkningen bakom prioritetsindex" aria-label="Visa beräkningen för ${esc(i.yrke)}">${ikon('sok')}</button>${merMeny}</div>
            </td>
        `;
        // Cache item-referensen på TR så suggestion-handler kan plocka upp den
        tr._prioItem = i;
        tbody.appendChild(tr);
    });
    tillampaDataStil(tbody);
    // Grundvyn gömmer det sekundära; talen finns också i beviset (förstoringsglaset).
    flerKolumner('prio-table', PRIO_DOLDA_KOLUMNER, 'prio');

    // Bevis-popup för prio-rader
    tbody.querySelectorAll('.btn-evidence[data-prio-row]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const tr = btn.closest('tr');
            const item = tr?._prioItem;
            if (!item) return;
            _openEvidenceModal(_evidenceForPrioItem(item, ref));
        });
    });

    // #13 Suggestion-toggle-handler: expanderar en sub-rad under den klickade
    tbody.querySelectorAll('.btn-suggest').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const tr = /** @type {HTMLElement} */ (btn.closest('tr'));
            const item = tr._prioItem;
            if (!item) return;
            const next = tr.nextElementSibling;
            // Stäng om redan öppen
            if (next && next.classList.contains('suggest-row')) {
                next.remove();
                btn.setAttribute('aria-expanded', 'false');
                btn.textContent = 'Motiveringsförslag';
                return;
            }
            const suggestions = generateMotivationSuggestions(item);
            const newTr = document.createElement('tr');
            newTr.classList.add('suggest-row');
            const colCount = tr.children.length;
            if (suggestions.length === 0) {
                newTr.innerHTML = `<td colspan="${colCount}" class="bak-yta pad-8-16"><em class="f-dampad">Inga regelbaserade förslag matchar denna grupp. Använd kommentarsfältet för fri motivering.</em></td>`;
            } else {
                const items = suggestions.map(s => `<li class="ms-${s.type}">${s.text}</li>`).join('');
                newTr.innerHTML = `<td colspan="${colCount}"><div class="motivation-suggestions"><strong>${ikon('lampa')} Hypoteser att granska för ${esc(item.yrke)} / BAS ${esc(item.bas)}:</strong><ul>${items}</ul><p class="text-dampad-xs kursiv marg-t-6">Förslagen är regelbaserade frågeställningar — inte färdiga motiveringar. Verifiera mot data och dokumentera i kommentarsfältet ovan.</p></div></td>`;
            }
            /** @type {HTMLElement} */ (tr.parentNode).insertBefore(newTr, tr.nextSibling);
            tillampaFlerKolumner('prio-table');   // radens colspan följer kolumnerna som syns
            btn.setAttribute('aria-expanded', 'true');
            btn.textContent = 'Dölj motiveringsförslag';
        });
    });
    // Listeners för bristyrke-toggle och kommentarer
    tbody.querySelectorAll('.brist-toggle').forEach(cb => {
        cb.addEventListener('change', e => {
            const aid = /** @type {HTMLElement} */ (e.target).dataset.aid || '';
            if (/** @type {HTMLInputElement} */ (e.target).checked) state.bristAids.add(aid);
            else state.bristAids.delete(aid);
            renderPrioritering();
        });
    });
}

// Lyssnare för konfigurerbara tröskelvärden
function _readPrioConfigInputs() {
    const get = (id, def) => {
        const el = document.getElementById(id);
        if (!el) return def;
        const v = parseFloat(/** @type {HTMLInputElement} */ (el).value);
        return isNaN(v) ? def : v;
    };
    state.prioConfig = {
        atgardThreshold:    get('prio-cfg-atgard',    PRIO_CONFIG_DEFAULTS.atgardThreshold),
        akutMinN:    Math.max(1, Math.round(get('prio-cfg-akutN', PRIO_CONFIG_DEFAULTS.akutMinN))),
        bevakaThreshold:    get('prio-cfg-bevaka',    PRIO_CONFIG_DEFAULTS.bevakaThreshold),
        analyseraThreshold: get('prio-cfg-analysera', PRIO_CONFIG_DEFAULTS.analyseraThreshold)
    };
    // Visa "anpassad konfiguration"-flagga om något skiljer sig
    const isCustom = JSON.stringify(state.prioConfig) !== JSON.stringify(PRIO_CONFIG_DEFAULTS);
    const flag = document.getElementById('prio-cfg-custom-flag');
    if (flag) flag.style.display = isCustom ? 'inline' : 'none';
}

// Viktnings-inputs
function _readPrioWeightsInputs() {
    const get = (id, def) => {
        const el = document.getElementById(id);
        if (!el) return def;
        const v = parseFloat(/** @type {HTMLInputElement} */ (el).value);
        return isNaN(v) ? def : Math.max(0, v);
    };
    state.prioWeights = {
        avvikelse:    get('prio-w-avvikelse',    PRIO_WEIGHTS_DEFAULTS.avvikelse),
        volym:        get('prio-w-volym',        PRIO_WEIGHTS_DEFAULTS.volym),
        jamstalldhet: get('prio-w-jamstalldhet', PRIO_WEIGHTS_DEFAULTS.jamstalldhet)
    };
    const sumEl = document.getElementById('prio-w-sum');
    const sum = state.prioWeights.avvikelse + state.prioWeights.volym + state.prioWeights.jamstalldhet;
    if (sumEl) sumEl.textContent = `Summa: ${sum} (normaliseras till 100% automatiskt)`;
}

// Kostnadsberäknings-inputs (månader + PO-påslag)
export function _readCostSettings() {
    const monthsEl = document.getElementById('prio-cost-months');
    const poEl     = document.getElementById('prio-po-pct');
    const months   = monthsEl ? parseInt(/** @type {HTMLInputElement} */ (monthsEl).value, 10) || COST_DEFAULTS.months : COST_DEFAULTS.months;
    const poPct    = poEl ? parseFloat(/** @type {HTMLInputElement} */ (poEl).value) : COST_DEFAULTS.poPct;
    state.costSettings = {
        months: Math.max(installningsGrans('manader').min, Math.min(installningsGrans('manader').max, months)),
        poPct:  Math.max(installningsGrans('poPct').min, Math.min(installningsGrans('poPct').max, isNaN(poPct) ? COST_DEFAULTS.poPct : poPct))
    };
    const sum = document.getElementById('prio-cost-summary');
    if (sum) {
        const isCustom = state.costSettings.months !== COST_DEFAULTS.months || Math.abs(state.costSettings.poPct - COST_DEFAULTS.poPct) > 0.01;
        sum.innerHTML = isCustom
            ? `<strong class="farg-varning">${ikon('kugghjul')} Anpassad konfiguration:</strong> ${state.costSettings.months} mån × ${svPoPct(state.costSettings.poPct)} PO`
            : `Standard: ${state.costSettings.months} mån × ${svPoPct(state.costSettings.poPct)} PO (ett standardantagande; organisationen sätter sitt eget värde)`;
    }
}
// Fälten står under Inställningar i sidhuvudet (gäller alla flikar): Prioritering räknas om direkt, och den flik som
// visas ritas om så att Löneöversyn, gruppdossiern och handlingsplanen följer samma period och påslag.
function _kostnadAndrad() {
    _readCostSettings();
    if (!state.data.length) return;
    renderPrioritering();
    const aktiv = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
    if (aktiv && aktiv !== 'prioritering' && typeof ritaFlik === 'function') ritaFlik(aktiv);
}

// ---- Print-to-PDF: komplett rapport ----
// Använder webbläsarens inbyggda "Skriv ut → Spara som PDF". Inga externa beroenden.

// ---- Figurer för diagramkärnan (ADR-39, steg 3) ----
// Kostnadsfördelningen (Pareto) som liggande, sorterade staplar på EN axel — inte staplar och en linje mot var sin
// axel, där höjd och läge läses mot olika skalor. Den
// kumulativa andelen står som text vid varje stapel i stället för som en linje mot en andra axel, och grupperna som
// tillsammans når 80 % av kostnaden är en egen serie.
const PRIO_KOSTNAD_MAX = 15;
/** Meningen under kostnadsdiagrammet: vad de grupper som inte ritas står för. Tom när alla ritas. */
/** @param {ReturnType<typeof kostnadskurva>} kurva */
function _prioKostnadNot({ ovriga, ovrigaSumma: summa, total: totalt }) {
    if (!ovriga || !(totalt > 0)) return '';
    return `Diagrammet visar de ${PRIO_KOSTNAD_MAX} grupper som kostar mest. Övriga ${ovriga} grupper står tillsammans för ${talformat(summa, 'kr')} per år (${svPct(100 * summa / totalt, 0)} av kostnaden) och finns i tabellen nedan.`;
}
function _prioKostnadFigur(allaVisade, allCumPct) {
    // Högst PRIO_KOSTNAD_MAX grupper ritas; resten redovisas som en mening under diagrammet (_prioKostnadNot) — en
    // sammanlagd stapel för dem blir längst av alla och gör de övriga svåra att läsa. Med fyrtio grupper blev
    // diagrammet annars över tusen punkter högt.
    const visade = allaVisade.slice(0, PRIO_KOSTNAD_MAX), cumPct = allCumPct.slice(0, PRIO_KOSTNAD_MAX);
    const namn = (i, n) => `#${n + 1} ${_rfKorta(String(i.yrke), 26)} · BAS ${i.bas}`;
    const y = visade.map(namn), n80 = cumPct.findIndex(p => p >= 80);
    const inom = n => n80 < 0 || n <= n80;
    const lager = (serie, farg, opacitet, valj) => ({ marke: 'stapel', riktning: 'liggande', lage: 'overlagrad', serie, farg, opacitet,
        data: visade.map((i, n) => ({ i, n })).filter(({ n }) => valj(n)).map(({ i, n }) => ({ y: y[n], x: i.annualGapTotal, yrke: i.yrke, bas: i.bas, sektor: sektorsnamn(i.aid), n: i.n, kum: cumPct[n],
            etikett: `${_fmtCost(i.annualGapTotal)} · ${svPct(cumPct[n], 0)}`, markering: markeringFor(i.bas, i.yrke) })),
        tips: d => [[`${d.yrke} · BAS ${d.bas}`], ['Kostnad', `${talformat(d.x, 'kr')}/år`], ['Kumulativ andel', talformat(d.kum, 'pct')]] });
    return { beskrivning: 'Årskostnad per grupp, störst först, med den kumulativa andelen av totalkostnaden som text. Siffrorna finns i prioriteringstabellen nedan.',
        urval: [URVAL.bas, URVAL.yrkesgrupp, URVAL.sektor, URVAL.antal], y: { skala: 'band', ordning: y, etikettMax: 40 }, x: { skala: 'linjar', titel: 'Årskostnad (kr) · procenttalet är kumulativ andel', format: 'kr' },
        hojd: Math.max(170, 90 + visade.length * 28),
        lager: [lager('Når tillsammans 80 % av kostnaden', PALETTE.serie[0], 1, inom), lager('Övriga', PALETTE.serie[0], 0.4, n => !inom(n))].filter(l => l.data.length) };
}

// Zonernas rubriker i matrisen, med versaler: de två yttre zonerna säger gränsen ur inställningen («Mer än 5 % under»,
// «Mer än 5 % över»), de två inre heter som statusarna. Den första zonen rymmer både Börja här och Under referens,
// liten grupp; bubblornas färg visar vilken. En rubrik som inte ryms på en rad bryts på två (_rfZonEtiketter).
/**
 * @param {'atgard'|'bevaka'|'ok'|'analysera'} zon
 * @param {{atgardThreshold:number, analyseraThreshold:number}} cfg
 */
function _prioZonNamn(zon, cfg) {
    const namn = zon === 'atgard' ? `Mer än ${_prioGrans(cfg.atgardThreshold)} under`
        : zon === 'analysera' ? `Mer än ${_prioGrans(cfg.analyseraThreshold)} över` : PRIO_STATUS_INFO[zon].label;
    return namn.toUpperCase();
}

// Matrisen: en punktserie per status (förklaringen kan dölja en status), zoner för tröskelvärdena med namn, och
// gruppens namn som text på punkten enligt valt etikettläge.
function _prioMatrisFigur(items, etikettlage, refLabel, cfg) {
    const kr = v => talformat(v, 'kr');
    const pm = (v, dec) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(dec).replace('.', ',')}`;
    const kostnad = i => Math.max(i.annualGapTotal, i.annualOverTotal);
    const storst = Math.max(1, ...items.map(kostnad));
    const tips = d => [[`#${d.rang} ${d.yrke}`], [`BAS ${d.bas}`, `n = ${d.n} (Kv: ${d.kvN}, Mä: ${d.maN})`], ['Median', kr(d.median)],
        [`Referens (${d.refKalla})`, kr(d.refMedian)], ['Avvikelse', `${pm(d.x, 2)} % (${pm(d.diffKr, 0).slice(0, 1)}${kr(Math.abs(d.diffKr))}/mån)`],
        ...(d.gapPct != null ? [['Skillnad kvinnor–män', `${pm(d.gapPct, 1)} %`]] : []),
        ...(d.atgard > 0 ? [['Kostnad att nå referensen/år', kr(d.atgard)]] : d.over > 0 ? [['Överlönekostnad/år', kr(d.over)]] : []),
        ['Prioriteringsindex', `${svTal(d.index, 0)}/100`]];
    // Namnen undviker bubblorna och varandra (etikettLage 'undvik'); ett namn som står en bit från sin bubbla får en
    // hänvisningslinje.
    const lager = Object.keys(PRIO_STATUS_INFO).map(status => ({
        marke: 'punkt', serie: PRIO_STATUS_INFO[status].label, farg: PALETTE.prio[status], opacitet: 0.72, kant: FARG.vit, tips, etikettLage: 'undvik',
        data: items.filter(i => i.status === status && isFinite(i.diffPct) && i.n > 0).map(i => {
            const etikett = _makePrioLabel(i, i.rank, etikettlage);
            return { x: +i.diffPct.toFixed(2), y: i.n, storlek: Math.max(4, 16 * Math.sqrt(Math.max(kostnad(i), storst * 0.02) / storst)),
                     ...(etikett ? { etikett } : {}), rang: i.rank, yrke: i.yrke, bas: i.bas, sektor: sektorsnamn(i.aid), n: i.n, kvN: i.kvN, maN: i.maN, median: i.median,
                     refKalla: i.refSource, refMedian: i.refMedian, diffKr: i.diffKr, gapPct: i.gapPct, atgard: i.annualGapTotal, over: i.annualOverTotal,
                     index: i.priorityIndex, markering: markeringFor(i.bas, i.yrke) };
        })
    })).filter(l => l.data.length);
    // X-axeln rymmer både datat och tröskelzonerna, med luft; noll är alltid med.
    const tAt = cfg.atgardThreshold, tBe = cfg.bevakaThreshold, tAn = cfg.analyseraThreshold;
    const diff = items.map(i => i.diffPct).filter(v => isFinite(v));
    const dMin = diff.length ? Math.min(...diff) : tAt - 5, dMax = diff.length ? Math.max(...diff) : tAn + 5;
    const spann = dMax - dMin, luft = Math.max(2, spann * 0.08);
    const xMin = Math.min(dMin - luft, tAt - Math.max(3, spann * 0.05), -1), xMax = Math.max(dMax + luft, tAn + Math.max(3, spann * 0.05), 1);
    const antal = items.map(i => i.n).filter(v => v > 0), stor = antal.length > 1 && Math.max(...antal) / Math.min(...antal) > 10;
    const zon = (x0, x1, farg, etikett, textfarg) => ({ typ: 'zon', x0, x1, farg, opacitet: 0.07, etikett, textfarg });
    return { beskrivning: 'Prioriteringsmatris: varje grupps avvikelse mot referensen mot gruppens storlek, med kostnaden som bubblans storlek. Samma grupper listas i tabellen nedan.',
        urval: [URVAL.bas, URVAL.yrkesgrupp, URVAL.sektor, URVAL.antal, URVAL.avvikelse], x: { skala: 'linjar', titel: `Avvikelse mot ${refLabel} (%)`, doman: [xMin, xMax], nollinje: true },
        // Logskala bara när grupperna skiljer sig med mer än en tiopotens; annars är en vanlig axel lättare att läsa.
        y: stor ? { skala: 'log', titel: 'Antal personer i gruppen (log skala)' } : { skala: 'linjar', titel: 'Antal personer i gruppen' },
        // Zonerna: gränserna ur inställningen ytterst, statusarnas namn i mitten (_prioZonNamn).
        referens: [zon(xMin, tAt, PALETTE.prio.akut, _prioZonNamn('atgard', cfg), FARG.granska), zon(tAt, tBe, PALETTE.semantic.varning, _prioZonNamn('bevaka', cfg), FARG.varning),
                   zon(tBe, tAn, PALETTE.semantic.ok, _prioZonNamn('ok', cfg), FARG.ok), zon(tAn, xMax, PALETTE.prio.analysera, _prioZonNamn('analysera', cfg), FARG.infoMork)].filter(z => z.x1 > z.x0),
        lager };
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartPrioritering() {
    // Menyn Mer på raderna. Ett val stänger menyn och ger fokus tillbaka till knappen Mer innan valet körs (fångstfasen,
    // före valens egna lyssnare): gruppdossiern lämnar då tillbaka fokus till Mer när den stängs, inte till ett dolt menyval.
    document.addEventListener('click', e => {
        const val = /** @type {HTMLElement} */ (e.target).closest('.prio-mer .chart-export-meny button');
        if (!val) return;
        const wrap = /** @type {HTMLElement} */ (val.closest('.prio-mer'));
        const knapp = /** @type {HTMLElement} */ (wrap.querySelector(':scope > .chart-export-btn'));
        /** @type {HTMLElement} */ (wrap.querySelector('.chart-export-meny')).hidden = true;
        knapp.setAttribute('aria-expanded', 'false');
        knapp.focus();
    }, true);
    // En öppnad meny som inte ryms under knappen i tabellens rullyta öppnas uppåt (tabellen rullar i sidled, så en meny
    // som går under rullytans kant skulle annars klippas). Körs efter 11-diagramexport.js, som har öppnat menyn.
    document.addEventListener('click', e => {
        const knapp = /** @type {HTMLElement} */ (e.target).closest('.prio-mer > .chart-export-btn');
        if (!knapp) return;
        const wrap = /** @type {HTMLElement} */ (knapp.parentElement);
        const meny = /** @type {HTMLElement} */ (wrap.querySelector('.chart-export-meny'));
        wrap.classList.remove('uppat');
        if (meny.hidden) return;
        const yta = wrap.closest('.table-container');
        if (!yta) return;
        const y = yta.getBoundingClientRect(), m = meny.getBoundingClientRect(), k = knapp.getBoundingClientRect();
        if (m.bottom > y.bottom && k.top - y.top > m.height) wrap.classList.add('uppat');
    });
    // Lyssnare för referens-toggle och etikett-toggle
    document.querySelectorAll('input[name="prio-ref"]').forEach(el => {
        el.addEventListener('change', renderPrioritering);
    });
    document.getElementById('prio-label-mode')?.addEventListener('change', renderPrioritering);
    document.getElementById('prio-filter-quickwin')?.addEventListener('change', renderPrioritering);
    document.getElementById('prio-filter-brist')?.addEventListener('change', renderPrioritering);
    // F: Stegvis konsekvensanalys — visar effekt om vi gör topp N
    document.getElementById('btn-prio-consequence')?.addEventListener('click', () => {
        const panel = document.getElementById('prio-consequence-panel');
        if (!panel) return;
        if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
        const ref = _selectedPrioReference();
        const items = computePrioritization(ref);
        if (!items.length) { panel.innerHTML = '<p class="farg-dampad pad-12">Ingen data att analysera.</p>'; panel.style.display='block'; return; }
        const totalCost = items.reduce((s, i) => s + i.annualGapTotal, 0);
        const checkpoints = [3, 5, 10, 15, 20, 30, items.length];
        const fmt = new Intl.NumberFormat('sv-SE');
        let rows = '';
        let cumCost = 0;
        items.forEach((i, idx) => {
            cumCost += i.annualGapTotal;
            if (checkpoints.includes(idx + 1)) {
                const pctOfTotal = totalCost > 0 ? svTal(cumCost / totalCost * 100, 0) : '0';
                const personerLyfta = items.slice(0, idx + 1).reduce((s, x) => s + x.n, 0);
                rows += `<tr><td>Topp <strong>${idx + 1}</strong></td><td class="t-hoger">${fmt.format(personerLyfta)} pers</td><td class="t-hoger">${_fmtCost(cumCost)}</td><td class="t-hoger">${pctOfTotal} %</td></tr>`;
            }
        });
        panel.innerHTML = `
        <div class="bak-white ram-1-kant rund-8 pad-14-16">
            <h4 class="underrubrik">Stegvis konsekvensanalys: budgetpåverkan om N grupper åtgärdas</h4>
            <p class="text-dampad-sm lh-1_55 marg-0-0-10">
                Visar kumulativ kostnad och täckningsgrad om de prioriterade grupperna åtgärdas i ordning. Det gör det lättare att välja ambition, till exempel de fem första i år eller de tio första.
            </p>
            <table class="data-table st-088">
                <thead><tr><th>Åtgärd</th><th class="t-hoger">Antal personer</th><th class="t-hoger">Kostnad att nå referensen</th><th class="t-hoger">Andel av total</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
        panel.style.display = 'block';
    });
    ['prio-cfg-atgard','prio-cfg-akutN','prio-cfg-bevaka','prio-cfg-analysera'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            _readPrioConfigInputs();
            renderPrioritering();
        });
    });
    document.getElementById('prio-cfg-reset')?.addEventListener('click', () => {
        /** @type {HTMLInputElement} */ (document.getElementById('prio-cfg-atgard')).value    = String(PRIO_CONFIG_DEFAULTS.atgardThreshold);
        /** @type {HTMLInputElement} */ (document.getElementById('prio-cfg-akutN')).value     = String(PRIO_CONFIG_DEFAULTS.akutMinN);
        /** @type {HTMLInputElement} */ (document.getElementById('prio-cfg-bevaka')).value    = String(PRIO_CONFIG_DEFAULTS.bevakaThreshold);
        /** @type {HTMLInputElement} */ (document.getElementById('prio-cfg-analysera')).value = String(PRIO_CONFIG_DEFAULTS.analyseraThreshold);
        _readPrioConfigInputs();
        renderPrioritering();
    });
    ['prio-w-avvikelse','prio-w-volym','prio-w-jamstalldhet'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            _readPrioWeightsInputs();
            renderPrioritering();
        });
    });
    document.getElementById('prio-w-reset')?.addEventListener('click', () => {
        /** @type {HTMLInputElement} */ (document.getElementById('prio-w-avvikelse')).value    = String(PRIO_WEIGHTS_DEFAULTS.avvikelse);
        /** @type {HTMLInputElement} */ (document.getElementById('prio-w-volym')).value        = String(PRIO_WEIGHTS_DEFAULTS.volym);
        /** @type {HTMLInputElement} */ (document.getElementById('prio-w-jamstalldhet')).value = String(PRIO_WEIGHTS_DEFAULTS.jamstalldhet);
        _readPrioWeightsInputs();
        renderPrioritering();
    });
    ['prio-cost-months','prio-po-pct'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', _kostnadAndrad);
        document.getElementById(id)?.addEventListener('change', _kostnadAndrad);
    });
    document.getElementById('prio-cost-reset')?.addEventListener('click', () => {
        /** @type {HTMLInputElement} */ (document.getElementById('prio-cost-months')).value = String(COST_DEFAULTS.months);
        /** @type {HTMLInputElement} */ (document.getElementById('prio-po-pct')).value      = String(COST_DEFAULTS.poPct);
        _kostnadAndrad();
    });
    // Initiera period-sammanfattningen vid sidladdning
    setTimeout(() => { _readCostSettings(); visningNy(); }, 0);   // kostnadsinställningarna läses: ingen ritad flik visas igen (ADR-81)
    document.getElementById('btn-export-prio-excel')?.addEventListener('click', () => medExportLage(() => {
        const table = document.getElementById('prio-table');
        if (table) {
            const wb = tabellTillBok('prio-table', 'Prioritering');
            if (wb) { _laggTillMetodblad(wb); XLSX.writeFile(wb, 'prioriteringslista.xlsx'); _visaExportvarning(); }
        }
    }));
}

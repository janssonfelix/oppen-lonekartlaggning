// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Compliance overview ----
import { aidKriterier } from '../lib/aidkontroll.js';
import { hanterade as _agHanterade, stegLikaArbete, stegLikvardigt } from '../lib/attgora.js';
import { bedomUnderlag, medFlerKriterier, mdeFranSe } from '../lib/datakvalitet.js';
import { personOrd } from '../lib/namn.js';
import { gruppMde, organisationensKvotKI, osakerhetKonstanter, styrkeanalys } from '../lib/osakerhet.js';
import { forklaringsmodellArStandard } from '../lib/regression.js';
import { svPct, svTal } from '../lib/talformat.js';
import { kravstatus, oversiktNyckeltal } from '../lib/vymodell-oversikt.js';
import { esc } from './01-html-och-tillganglighet.js';
import { rapporteraFel } from './03-hjalpfunktioner.js';
import { ikon } from './03-ikoner.js';
import { _parForRedovisning, kInstalld, kTroskel, statGolv } from './06-k-troskel.js';
import { T } from './09-termer.js';
import { hamtaBasIntervall, hamtaData, harReferens, policyFor, referensKortnamn, referensNamn, state } from './12-tillstand.js';
import { renderOutliers } from './15-extremvarden-basrang.js';
import { renderDataValidationReport } from './16-inlasningskontroll.js';
import { buildActionChecklist, renderActionChecklist } from './18-atgardslista.js';
import { ritaOgonblicksbildJamforelse } from './19-konfiguration.js';
import { likvardighetResultat } from './34-likvardigt-arbete.js';
import { _laNyckel, _laOversiktRader } from './41-lika-arbete.js';
import { runOLSRegression } from './51-lika-arbete-regressionskort.js';
import { _handlingsplanSeedRows } from './56-handlingsplan.js';
import { _bes8Areas } from './61-regler-och-praxis.js';
import { kTroskelLank } from './86-installningar.js';
import { sokUppdatera } from './87-sok.js';
function setCompCard(id, count, total, valueText, cardState) {
    const card = document.getElementById(id);
    const icon = document.getElementById(`${id}-icon`);
    const val  = document.getElementById(`${id}-val`);
    if (!card || !icon || !val) return;
    // Bara talet är fett; resten av raden (vad som räknats, noten om exporten) står i normal vikt.
    const tal = total ? `${count} av ${total}` : '';
    val.innerHTML = tal && valueText.startsWith(tal) ? `<strong>${tal}</strong>${esc(valueText.slice(tal.length))}` : esc(valueText);
    icon.innerHTML = { ok: ikon('bock'), warn: ikon('statusVarning'), crit: ikon('stopp'), na: '—' }[cardState] || '—';
    card.className = `compliance-card ${cardState}`;
}

/** Läget mot lagkraven på Översikt, ur vymodellen (kravstatus i src/lib/vymodell-oversikt.js). */
export function ritaKravstatus() {
    const overview = document.getElementById('compliance-overview');
    const d = hamtaData();
    if (!overview || !d.length) return;
    overview.style.display = 'block';
    // Det exporterna kan jämföra (ADR-51): den inställda tröskeln, också på skärmen.
    const vm = /** @type {NonNullable<ReturnType<typeof kravstatus>>} */ (kravstatus(d, { bas: hamtaBasIntervall(), k: kInstalld(), golv: statGolv(),
        oversikt: _laOversiktRader(d), policyFor: harReferens() ? policyFor : null, statistik: state.statistik }));

    // 1–2. Säkerställd skillnad och könsskevhet — bara i jämförbara BAS (båda könen ≥ k).
    const maskText = vm.maskerade ? ` · ${vm.maskerade} intervall redovisas inte i exporten (ett kön under ${kInstalld()})` : '';
    if (vm.jamforbara === 0) {
        setCompCard('comp-gap', 0, 0, `Inga jämförbara ${T.niva.fl}${maskText}`, 'na');
        setCompCard('comp-skev', 0, 0, `Inga jämförbara ${T.niva.fl}${maskText}`, 'na');
    } else {
        setCompCard('comp-gap', vm.gap.antal, vm.gap.av, `${vm.gap.antal} av ${vm.gap.av} jämförbara ${T.niva.fl}${maskText}`, vm.gap.lage);
        setCompCard('comp-skev', vm.skev.antal, vm.skev.av, `${vm.skev.antal} av ${vm.skev.av} jämförbara ${T.niva.fl}${maskText}`, vm.skev.lage);
    }

    // 3. Policy P10-underläge — referensen namnges; utan referens ett tomläge (ADR-28)
    const polLabel = document.getElementById('comp-pol-label');
    if (polLabel) polLabel.textContent = harReferens() ? `Under P10 i ${referensKortnamn()}` : 'Under ställningstagandets P10';
    const polSub = document.getElementById('comp-pol-sub');
    if (polSub) polSub.textContent = referensNamn();
    const ref = vm.referens;
    if (!ref) setCompCard('comp-pol', 0, 0, 'Kräver lönepolitiskt ställningstagande', 'na');
    // Inga rader per BAS-intervall (t.ex. en ren AID-policy): grönt "0 av 0" vore falskt lugnande, så kortet blir 'na'.
    else if (ref.av === 0) setCompCard('comp-pol', 0, 0, `${referensNamn()} saknar rader per ${T.niva.en}`, 'na');
    else setCompCard('comp-pol', ref.antal, ref.av, `${ref.antal} av ${ref.av} ${T.niva.fl}`, ref.lage);

    // 4. Jämförelsestatistiken
    // Bara grupper med minst k, som Löneläget; de utelämnade nämns med antal.
    const bm = vm.statistik;
    if (bm) {
        const k = kInstalld();
        const utel = bm.utelamnade ? ` · ${bm.utelamnade} ${bm.utelamnade === 1 ? T.enhet.en : T.enhet.fl} visas inte här (färre än ${k} ${personOrd(k)})` : '';
        if (bm.av === 0) setCompCard('comp-bm', 0, 0, `Ingen matchning hittad${utel}`, 'na');
        else setCompCard('comp-bm', bm.antal, bm.av, `${bm.antal} av ${bm.av} ${T.enhet.fl} i ${T.niva.en}${utel}`, bm.lage);
    }
    // Länken till fliken Löneläget bara när fliken finns (jämförelsestatistik inläst).
    const bmLank = document.querySelector('#comp-bm .comp-lank');
    if (bmLank) /** @type {HTMLElement} */ (bmLank).hidden = !state.statistik.length;
}

// ---- Underlagets kvalitet (ADR-19): svagaste länken avgör ----
/** @param {{reg?: any}} [val] reg: regressionen när anroparen just kört den — ett värde som skickas vidare, ingen cache (ADR-17) */
export function bedomningUnderlag({ reg: given } = {}) {
    const d = hamtaData();
    if (!d.length) return null;
    const reg = given || runOLSRegression();
    const modell = reg.error ? 'fel' : (reg.fellBackFromFull ? 'minimal' : 'full');   // 'full' = den valda modellen gick att skatta (ADR-56)
    const mde = reg.error ? null : mdeFranSe(reg.seKonR);
    // Frasen följer med bara när modellen inte är standard, så att standardtexten (och golden-facit) står still (ADR-56).
    const modellFras = !reg.error && reg.modell && !forklaringsmodellArStandard({ ...reg.modell, skal: '' }) ? reg.fras : undefined;
    const b = bedomUnderlag(d, { k: kInstalld(), audit: state.dataAudit, mde, modell, modellFras });   // jämförbarheten gäller det som lämnar verktyget (ADR-51)
    // Kontrollen av AID-kodningen (ADR-33) läggs till datakvalitetens kriterier.
    let aid = [];
    try { aid = aidKriterier(d, { k: kInstalld(), harAnsvar: !!state.ansvarKolumn }); }
    catch (e) { rapporteraFel('Underlagets kvalitet: AID-kodning', e); }
    return medFlerKriterier(b, aid);
}

export const UK_ETIKETT = { ok: 'OK', varning: 'Varning', kritisk: 'Kritisk' };
const UK_IKON = { ok: 'bock', varning: 'statusVarning', kritisk: 'statusKritisk', info: 'info' };
/**
 * Statusmärket med ikon och ord, i samma form som märkena i Underlagets kvalitet. Ikonen är dold för hjälpmedel
 * (ikon()); ordet bär läget, så att det inte bara syns i färgen. Bara på skärmen.
 * @param {'ok'|'varning'|'kritisk'|'info'} status
 * @param {string} [ord] ordet, om det inte är UK_ETIKETT:s (upplysningen har inget där)
 */
export function statusMarke(status, ord = UK_ETIKETT[status]) {
    return `<span class="uk-marke uk-${status}">${ikon(UK_IKON[status], 14)} ${esc(ord)}</span>`;
}
/** @param {{reg?: any}} [val] reg: regressionen när anroparen just kört den i samma varv (ADR-17) */
export function renderUnderlagetsKvalitet({ reg } = {}) {
    const host = document.getElementById('underlagets-kvalitet');
    if (!host) return;
    const b = bedomningUnderlag({ reg });
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
 * 95-procentigt percentil-bootstrapintervall för mediankvoten kvinnor/män i hela organisationen
 * (organisationensKvotKI i src/lib/osakerhet.js: B = 2000, seedat ur datat). Skrivs till state.bootstrapCI, som
 * cachar det så att det inte räknas om vid varje rendering; null när något kön är under statGolv(). Det som visas läses genom
 * bootstrapCIGallande() (golvet i nyckeln, nedan). Skillnaden i
 * procent (gapPct) har verktygets tecken, negativ när kvinnor ligger lägre.
 */
export function computeBootstrapCI() { state.bootstrapCI = _skattning('bootstrapCI', statGolv()); }

// ---- Skattningarna per golv (ADR-103) ----
// Bootstrap-KI:t och styrkan sparas i state.bootstrapCI och state.powerAnalysis och beror på golvet, som är K_STANDARD på
// skärmen och kan vara högre i exportläget. Varje resultat minns sitt golv, och det som visas läses genom
// bootstrapCIGallande() och styrkaGallande(): ett resultat räknat vid ett annat golv används aldrig, utan det som gäller
// räknas en gång per golv och underlag. Så följer skärmens skattning aldrig med ut. Ett tomt fält som inte räknats
// (bakgrundsräkningen pågår) ger inget.
/** @type {WeakMap<object, number>} */
const _golvFor = new WeakMap();
/** Golvet där fältet senast räknades till null (då är null svaret vid det golvet). */
const _nollVid = /** @type {Record<string, number|undefined>} */ ({});
/** @type {Map<number, {d: any[], n: number, [falt: string]: any}>} */
const _andraGolv = new Map();
const _RAKNA = {
    bootstrapCI: golv => {
        const t0 = performance.now(), ki = organisationensKvotKI(hamtaData(), golv);
        return ki ? { ratio: ki.ratio, gapPct: ki.gapPct, elapsed: performance.now() - t0, B: ki.B } : null;
    },
    powerAnalysis: golv => styrkeanalys(hamtaData(), golv),
};
function _skattning(falt, golv) {
    const ut = _RAKNA[falt](golv);
    if (ut) _golvFor.set(ut, golv); else _nollVid[falt] = golv;
    return ut;
}
/** Glömmer skattningarna vid andra golv (tomStatistikcacher och Rensa all data). */
export function skattningarSlapp() { _andraGolv.clear(); delete _nollVid.bootstrapCI; delete _nollVid.powerAnalysis; }
function _vidGolv(falt) {
    const golv = statGolv(), v = state[falt];
    if (v != null ? _golvFor.get(v) === golv : (_nollVid[falt] === undefined || _nollVid[falt] === golv)) return v;
    let m = _andraGolv.get(golv);
    if (!m || m.d !== state.data || m.n !== state.data.length) { m = { d: state.data, n: state.data.length }; _andraGolv.set(golv, m); }
    if (!(falt in m)) { try { const ut = _RAKNA[falt](golv); if (ut) _golvFor.set(ut, golv); m[falt] = ut; } catch (_e) { m[falt] = null; } }
    return m[falt];
}
/** Bootstrap-KI:t för golvet som gäller nu (statGolv), eller null. */
export function bootstrapCIGallande() { return _vidGolv('bootstrapCI'); }
/** Styrkan för golvet som gäller nu (statGolv), eller null. */
export function styrkaGallande() { return _vidGolv('powerAnalysis'); }

/**
 * Formaterar bootstrap-CI som textsuffix för punktestimat, med samma tecken som talet framför.
 * Returnerar t.ex. " [95 % KI: −17,8 % till −11,9 %]" (ordet "till" när en gräns är negativ, så att strecket inte
 * läses som minustecken), " [95 % KI: 3,1–6,4 %]" annars, eller tom sträng om CI saknas.
 * @param {{lo:number, hi:number}} ci
 * @param {number} [decimals=1]
 */
export function fmtCI(ci, decimals = 1) {
    if (!ci || !isFinite(ci.lo) || !isFinite(ci.hi)) return '';
    const intervall = ci.lo < 0 || ci.hi < 0 ? `${svPct(ci.lo, decimals)} till ${svPct(ci.hi, decimals)}` : `${svTal(ci.lo, decimals)}–${svPct(ci.hi, decimals)}`;
    const B = Number(state.bootstrapCI?.B || osakerhetKonstanter().B_ORGANISATION);
    return ` <span class="ci-bracket" title="95% bootstrap-konfidensintervall (B=${B})">[95 % KI: ${intervall}]</span>`;
}

// ---- #9 Power-analys: minsta detekterbara effektstorlek ----
/**
 * Minsta upptäckbara lönegap (procent) för regressionens könskoefficient vid 80 % styrka och α = 0,05, med σ för
 * log(lön) inom grupp (styrkeanalys i src/lib/osakerhet.js; golvet för grupperna är statGolv()).
 * @returns {null | {n:number, nKv:number, nMa:number, mdePct:number, sigma:number, sigmaKalla:'inomGrupp'|'helaUrvalet',
 *                   sigmaHela:number, sigmaGrupper:number, balanced:boolean}}
 */
export function computePowerAnalysis() { return _skattning('powerAnalysis', statGolv()); }

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
/**
 * @param {{punkter?: any[], reg?: any}} [val] punkter: Att göras lista; reg: regressionen när anroparen just kört den i
 *   samma varv (ADR-17). Båda är värden som skickas vidare, ingen cache.
 */
export function renderProcessTracker({ punkter: givna, reg: givenReg } = {}) {
    const host = document.getElementById('process-tracker');
    if (!host) return;

    const hasData = (() => { try { return hamtaData().length > 0; } catch (_e) { return false; } })();
    // `inget`: steget har inget att hantera i Att göra men är inte klart (alla kandidatpar har en grupp under tröskeln).
    const ICON = { klar: ikon('bock'), delvis: ikon('delvis'), ej: ikon('ruta'), manuell: ikon('streck'), inget: ikon('streck') };

    // safe(fn, fallback): kör härledningen skyddat; ett kast ger fallback-raden och rapporteras.
    const safe = (fn, fallback) => { try { const r = fn(); return r || fallback; } catch (e) { rapporteraFel('Processöversikten', e); return fallback; } };

    // Ett analyssteg är klart först när dess punkter i Att göra är hanterade — att analysen
    // har körts räcker inte (ADR-29). Listan byggs en gång för alla steg.
    const punkter = Array.isArray(givna) ? givna : (hasData ? safe(() => (typeof buildActionChecklist === 'function' ? buildActionChecklist({ reg: givenReg }) : []), []) : []);
    const klarmarkerade = state._actionChecklistDone || new Set();
    const hanterade = kategorier => _agHanterade(punkter, klarmarkerade, kategorier);   // src/lib/attgora.js

    const rows = [];

    // 1. Underlag inläst
    rows.push(hasData
        ? { n: 1, status: 'klar', title: '1. Underlag inläst', tab: 'dashboard', detail: `${hamtaData().length} rader inlästa — allt nedan bygger på detta.` }
        : { n: 1, status: 'ej',   title: '1. Underlag inläst', tab: 'dashboard', detail: 'Börja här: läs in lönefilen i Kom igång överst på Översikt eller i Filer och kvalitet (eller prova med demodata).' });

    // 2. § 8 Regler & praxis (kvalitativ bedömning per område)
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
        if (!hasData) return { n: 3, tab: 'matrix', title: `3. Lika arbete — samma ${T.enhet.en}`, status: 'ej', detail: 'Kräver inläst underlag.' };
        const reg = givenReg || ((typeof runOLSRegression === 'function') ? runOLSRegression() : null);
        const ok = !!(reg && !reg.error);
        const { t, d } = hanterade(['Lika arbete', 'Lika arbete, fördjupning']);
        return { n: 3, tab: 'matrix', title: `3. Lika arbete — samma ${T.enhet.en}`, ...stegLikaArbete({ regressionOk: ok, t, d }) };
    }, { n: 3, tab: 'matrix', title: `3. Lika arbete — samma ${T.enhet.en}`, status: 'ej', detail: 'Kräver inläst underlag.' }));

    // 4. § 3:10 Likvärdigt arbete (antal kandidatpar)
    rows.push(safe(() => {
        if (!hasData) return { n: 4, tab: 'likvardighet', title: '4. Likvärdigt arbete', status: 'ej', detail: 'Kräver inläst underlag.' };
        const lv = typeof likvardighetResultat === 'function' ? likvardighetResultat() : null;
        // Antalet står bredvid antalet hanterade punkter i Att göra, som utelämnar par med en grupp
        // under tröskeln — därför räknas de redovisade paren och de utelämnade nämns. Finns bara utelämnade
        // par säger steget det självt (tillståndet `inget`, knappen leder till fliken).
        const { par, utelamnade, not } = _parForRedovisning(lv && lv.pairs);
        const { t, d } = hanterade(['Likvärdigt arbete']);
        const steg = stegLikvardigt({ analys: !!lv, antalPar: par.length, utelamnade, k: kTroskel(), t, d });
        return { n: 4, tab: 'likvardighet', title: '4. Likvärdigt arbete', ...steg, detail: steg.detail + (not && steg.status !== 'inget' ? ' ' + not : '') };
    }, { n: 4, tab: 'likvardighet', title: '4. Likvärdigt arbete', status: 'ej', detail: 'Kräver inläst underlag.' }));

    // 5. § 3:11 Handlingsplan: raderna på fliken (förifyllda och egna) och statusen som fyllts i där (56-handlingsplan.js).
    rows.push(safe(() => {
        if (!hasData) return { n: 5, tab: 'handlingsplan', title: '5. Handlingsplan', status: 'ej', detail: 'Kräver inläst underlag.' };
        const rader = typeof _handlingsplanSeedRows === 'function' ? _handlingsplanSeedRows().rows : [];
        const t = rader.length;
        const genomforda = rader.filter(r => r[7] === 'Genomförd').length;
        const planerade = rader.filter(r => r[7] === 'Planerad' || r[7] === 'Pågår').length;
        const uppskjutna = rader.filter(r => r[7] === 'Skjuts upp').length;
        const ifyllda = rader.filter(r => r[3] || r[5] || r[6] || r[7]).length;
        const tomma = t - ifyllda;
        return {
            n: 5, tab: 'handlingsplan', title: '5. Handlingsplan',
            status: t === 0 ? 'ej' : genomforda >= t ? 'klar' : ifyllda > 0 ? 'delvis' : 'ej',
            detail: t === 0
                ? 'Inga rader att fylla i: ingen grupp under referensen och inga kandidatpar. Egna rader läggs till på fliken.'
                : ifyllda === 0
                    ? `${t} ${t === 1 ? 'rad' : 'rader'} att fylla i på fliken: sakligt skäl, ansvarig, tidsplan och status.`
                    : `${genomforda} av ${t} ${t === 1 ? 'rad' : 'rader'} genomförda${planerade ? `, ${planerade} planerade eller pågår` : ''}${uppskjutna ? `, ${uppskjutna} skjuts upp` : ''}${tomma ? `; ${tomma} utan något ifyllt` : ''}.`
        };
    }, { n: 5, tab: 'handlingsplan', title: '5. Handlingsplan', status: 'ej', detail: 'Kräver inläst underlag.' }));

    // 6. § 3:13 Samverkan — kan inte auto-härledas. Hör till Åtgärder: samverkan och uppföljning står på Handlingsplan.
    rows.push({ n: 6, tab: 'handlingsplan', avsnitt: 'hp-samverkan', title: '6. Samverkan med facket', status: 'manuell', detail: 'Manuellt steg: samverka om kartläggningen, analysen och åtgärderna och dokumentera samverkan. Stöd finns i kortet Samverkan & uppföljning på Handlingsplan; protokollet för gemensam lönebedömning finns under Exportera.' });

    // 7. Rapporttext — kan inte auto-härledas
    rows.push({ n: 7, tab: 'rapporttext', title: '7. Rapporttext', status: 'manuell', detail: 'Manuellt steg: gå igenom utkastet och rapportunderlaget och för in texten i dokumentationen.' });

    // 8. Dokumentation — kan inte auto-härledas
    rows.push({ n: 8, tab: 'dokumentera', title: '8. Dokumentation', status: 'manuell', detail: 'Manuellt steg: ladda ner Word-utkastet under Exportera, fyll i de gula fälten [HR fyller i] och spara filen som organisationens dokumentation.' });

    // 9. § 3:11–13 Uppföljning. Verktyget stödjer EN kartläggning — uppföljningen
    // av handlingsplanen sker i arbetsgivarens egen process, som samverkan och
    // dokumentation ovan.
    rows.push({ n: 9, tab: 'dokumentera', title: '9. Uppföljning av handlingsplanen', status: 'manuell', detail: 'Manuellt steg: följ upp planens åtgärder i organisationens egen process. Handlingsplanen exporteras under Exportera.' });

    const autoDone = rows.filter(r => r.status === 'klar').length;
    const autoTotal = rows.filter(r => r.status !== 'manuell').length;

    // Stegen grupperas under samma faser som menyn (en karta): Regler & praxis hör till Underlag.
    const FASER = { 1: '1 · Underlag', 3: '2 · Kartläggning', 5: '3 · Åtgärder', 7: '4 · Rapport' };
    const rowsHtml = rows.map(r => `
        ${FASER[r.n] ? `<div class="ptrack-fas">${FASER[r.n]}</div>` : ''}
        <div class="ptrack-row">
            <span class="ptrack-status" data-status="${esc(r.status)}" aria-hidden="true">${ICON[r.status] || ikon('ruta')}</span>
            <div class="ptrack-body">
                <div class="fs-md fw-600">${esc(r.title)}</div>
                <div class="ptrack-detail">${esc(r.detail)}</div>
                <button type="button" class="ptrack-goto" data-goto-tab="${esc(r.tab)}"${r.avsnitt ? ` data-goto-avsnitt="${esc(r.avsnitt)}"` : ''}>Gå till steget</button>
            </div>
        </div>`).join('');

    // Rubriknivå h3 (inte h2): kortet ligger i dashboard-flödet mellan KPI-korten
    // (h3) och datakvalitetspanelens h4:or — en h2 här skulle ge ett h2→h4-hopp som
    // axe-sviten flaggar (heading-order). h3 håller "öka med max ett".
    host.innerHTML = `
        <div class="card ptrack" role="region" aria-label="Kartläggningens steg">
            <h3>Kartläggningens steg — var står du?</h3>
            <p class="ptrack-intro">
                Hela lönekartläggningen, steg för steg. Verktyget kan se ${autoTotal} av de ${rows.length} stegen och sätter
                deras status ur ditt arbete; statusen <em>föreslår</em> nästa steg och dömer inte. De övriga
                ${rows.length - autoTotal} är manuella steg. ${autoTotal ? `<strong>Klara: ${autoDone} av de ${autoTotal} steg som verktyget kan se.</strong>` : ''}
            </p>
            ${rowsHtml}
        </div>`;
    // Nyckeltalet säger vad det räknar: listan har fler steg än de verktyget kan se.
    _laNyckel('nyckel-ov-process', hasData && autoTotal ? `Klara: ${autoDone} av ${autoTotal} steg som verktyget kan se` : '');
    // Processöversikten ritas vid start, vid varje inläsning och när en referens eller tröskeln ändras:
    // sidans läge följer med härifrån.
    ovRitaLage();
}

/**
 * Översikt efter inläsning. Före inläsning är sidan startytan Kom igång, med stegen under Fördjupning.
 * Efter inläsning visar sidan läget: filraden, nyckeltalen, Att göra och processen. Filerna, kvaliteten och
 * kvartilerna står i Filer och kvalitet respektive Lönestruktur. Klassen `har-data` på panelen styr vad som visas.
 */
/** Filer och kvalitet: underlagets kvalitet, extremvärdena och inläsningsrapporten. Ritas vid inläsning och vid flikbyte. */
export function renderFilerDelar() {
    /** @type {[string, () => void][]} */
    const delar = [['underlagets kvalitet', () => renderUnderlagetsKvalitet()], ['extremvärden', () => renderOutliers()],
        ['inläsningsrapporten', () => renderDataValidationReport()]];
    for (const [namn, fn] of delar) { try { fn(); } catch (e) { rapporteraFel(`Filer och kvalitet (${namn})`, e); } }
}

/** @type {boolean|null} */
let _ovHadeData = null;
export function ovRitaLage() {
    const vy = /** @type {HTMLElement} */ (document.getElementById('view-dashboard'));
    if (!vy) return;
    const d = (() => { try { return hamtaData(); } catch (_e) { return []; } })();
    const har = d.length > 0;
    vy.classList.toggle('har-data', har);
    // Filer och kvalitet: Underlagets kvalitet har inget att visa före inläsningen (sidindexet och sökningen hoppar över det då).
    const kvalitet = document.getElementById('avsnitt-ov-kvalitet');
    if (kvalitet) kvalitet.hidden = !har;
    if (typeof sokUppdatera === 'function') sokUppdatera();   // sökfältet i sidhuvudet: en öppen träfflista stängs när lönefilen läses in eller rensas
    if (har !== _ovHadeData) {
        // Läget byter: stegen står hopfällda under Fördjupning, före inläsning (under startytan) som efter.
        const proc = document.getElementById('avsnitt-ov-process');
        if (proc) /** @type {HTMLDetailsElement} */ (proc).open = false;
        _ovHadeData = har;
    }
    _ovRitaFilrad(har, d.length);
}

/** Raden överst efter inläsning: vad som är inläst, och länken till Filer och kvalitet där korten står. */
function _ovRitaFilrad(har, antal) {
    const rad = document.getElementById('ov-filrad');
    if (!rad) return;
    if (!har) { rad.textContent = ''; return; }
    rad.innerHTML = `<span><strong>Lönefil:</strong> ${svTal(antal, 0)} personer</span>`
        + `<span><strong>Referens:</strong> ${esc(harReferens() ? referensNamn() : 'ingen inläst')}</span>`
        + `<span><strong>Jämförelsestatistik:</strong> ${state.statistik.length ? `${svTal(state.statistik.length, 0)} rader` : 'ingen inläst'}</span>`
        + kTroskelLank()
        + `<a href="#" class="btn btn-secondary btn-sm" data-go-to-tab="filer">Filer och kvalitet</a>`;
}

/**
 * Minsta upptäckbara skillnad för en undergrupp (yrkesgrupp, BAS-rad) med σ ur computePowerAnalysis: spridningen i
 * log-lön INOM grupp (gruppMde i src/lib/osakerhet.js).
 * @param {number} nKv - antal kvinnor i gruppen
 * @param {number} nMa - antal män i gruppen
 * @param {number} [sigmaLog] - σ för log(lön) (default: hämta från cache)
 * @returns {null | {mdePct:number, level:'good'|'fair'|'poor', tooSmall:boolean}}
 */
export function computeGroupMDE(nKv, nMa, sigmaLog) {
    return gruppMde(nKv, nMa, sigmaLog || styrkaGallande()?.sigma);
}

// ---- Nyckeltalen ----
/** Nyckeltalen överst på Översikt, ur vymodellen (oversiktNyckeltal i src/lib/vymodell-oversikt.js). */
export function ritaNyckeltal() {
    const vm = oversiktNyckeltal(hamtaData(), kTroskel());
    if (!vm) return;
    /** @type {HTMLElement} */ (document.getElementById("stat-n")).textContent = String(vm.n);
    const konEl = document.getElementById('stat-kon');
    if (konEl) konEl.textContent = `${vm.nKv.toLocaleString('sv-SE')} / ${vm.nMa.toLocaleString('sv-SE')}`;
    /** @type {HTMLElement} */ (document.getElementById("stat-age")).textContent = vm.medelalder != null ? svTal(vm.medelalder, 1) : "–";
    const pgEl = document.getElementById("stat-paygap");
    if (pgEl) {
        if (vm.lage === 'ettKonSaknas') {
            pgEl.textContent = "-";
        } else if (vm.lage === 'underK') {
            // Minsta gruppstorlek (ADR-12): kvoten pekar ut de få i det mindre könet.
            pgEl.innerHTML = `–<div class="stat-tip">Visas inte: ett kön har färre än ${kTroskel()} ${personOrd(kTroskel())}.</div>`;
        } else {
            // Rå kvot för hela organisationen: direktivmarkeringen (≥ 5 %) står per grupp,
            // inte här — därför ingen hänvisning till den, och neutral färg: rågapet
            // är en utgångspunkt, inget fynd. Bedömningen görs per grupp i Lika arbete.
            const tipText = `Rå skillnad för hela organisationen, före hänsyn till ${T.enhet.en}, ${T.niva.en} och ålder. Se Lika arbete för skillnaden per grupp.`;
            // Förklaringen står i verktygstipset; under talet står bara vad det är för tal (nyckeltalsraden är en rad hög).
            pgEl.innerHTML = svPct(/** @type {number} */ (vm.kvotPct), 1) +
                `<div class="stat-tip" title="${esc(tipText)}">rå skillnad, innan ${T.enhet.en} och ${T.niva.en} räknats bort</div>`;
        }
    }
}

/** Översikts delar, i ordning: det som inläsningen ritar och som exportgrinden måste kunna rita om (ADR-51). */
export function renderOversiktDelar() {
    /** @type {any[]|undefined} */ let punkter;   // processöversikten läser Att göras punkter: byggs en gång
    /** @type {any} */ let reg;   // och samma regression: körs en gång och skickas vidare (ADR-17)
    /** @type {[string, () => void][]} */
    const delar = [['nyckeltal', () => ritaNyckeltal()], ['kompliansöversikt', () => ritaKravstatus()],
        ['Att göra', () => { reg = runOLSRegression(); punkter = renderActionChecklist({ reg }); }],
        ['processöversikten', () => renderProcessTracker({ punkter, reg })]];   // Var uppstår löneskillnaden ritas av Lönestruktur (renderTabContent('struktur'))
    for (const [namn, fn] of delar) { try { fn(); } catch (e) { rapporteraFel(`Översikt (${namn})`, e); } }
    const ab = document.getElementById('snapshot-comparison');
    if (ab && ab.style.display !== 'none' && typeof ritaOgonblicksbildJamforelse === 'function') ritaOgonblicksbildJamforelse();
}

// ---- Populate BAS selects ----
export function populateSelects() {
    const bas = hamtaBasIntervall();
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


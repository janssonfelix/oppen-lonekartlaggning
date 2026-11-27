// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Handlingsplan: mall, förifyllning från Prioritering och Likvärdigt arbete, export ----
// Förifyllt handlingsplansunderlag (Excel): seedar rader från Prioritering
// (grupper under referens) och paren i likvärdigt arbete. Gruppmått, inga individdata; det användaren
// fyllt i (sakligt skäl, ansvarig, tidsplan, status) ligger i state.handlingsplan och följer med.
// Renodlar analysflödet: verktyget levererar underlaget, planen färdigställs i Word.
// Delad seedning av handlingsplanen: rader från Prioritering (under referens, § 9)
// + par i likvärdigt arbete. Returnerar enbart de förifyllda dataraderna (utan tomrader) så att
// både Excel-exporten och skärm-mallen (ritaHandlingsplan) använder samma logik.
// Varifrån en förifylld rad kommer, som kolumnen Underlag och exporterna säger det.
import { periodkostnad, periodOrd } from '../lib/kostnad.js';
import { parMinstaGrupp } from '../lib/ktroskel.js';
import { liknarPersonuppgift } from '../lib/organisationspaket.js';
import { gruppSkillnadKr, SKAL_UTAN_BELOPP, skalForRad, skalSammanstallning, skalUnderlag, skalUtanBelopp, valideraSkal } from '../lib/sakligaskal.js';
import { svKr, svPct, svTal } from '../lib/talformat.js';
import { genitiv, termFras } from '../lib/termer.js';
import { meddelaSkarmlasare, esc } from './01-html-och-tillganglighet.js';
import { demoFilnamn, idagDatum, rapporteraFel } from './03-hjalpfunktioner.js';
import { navigeraTill } from './05-tabeller-och-lankar.js';
import { _parForRedovisning, _parUtelamnadeNot, kInstalld } from './06-k-troskel.js';
import { T } from './09-termer.js';
import { hamtaData, state } from './12-tillstand.js';
import { _laggTillMetodblad, _visaExportvarning } from './22-exporthjalpare.js';
import { medExportLage } from './23-exportgrind.js';
import { likvardighetResultat } from './34-likvardigt-arbete.js';
import { _valdPrioReferens, raknaPrioritering } from './55-prioritering.js';
export const HP_UNDERLAG_PRIO = 'Prioritering (under referensen)';
export const HP_UNDERLAG_PAR = 'Likvärdigt arbete (kandidatpar)';
const HP_UNDERLAG_EGEN = 'Egen rad';

// Fälten som fylls i per rad (ligger i state.handlingsplan, nycklade på raden). Rullistornas värden
// är det som står i exporterna; ett tomt värde betyder att inget är valt.
const HP_SAKLIGT = [['', '—'], ['Ja, sakligt skäl finns', 'Ja, sakligt skäl finns'], ['Nej, åtgärd behövs', 'Nej, åtgärd behövs'], ['Pågår', 'Pågår']];
const HP_STATUS = [['', '—'], ['Planerad', 'Planerad'], ['Pågår', 'Pågår'], ['Genomförd', 'Genomförd'], ['Skjuts upp', 'Skjuts upp (motivera under Tidsplan)']];
const HP_FALT = ['sakligt', 'ansvarig', 'tidsplan', 'status'];
// En egen rad (tillagd på fliken, nyckel "egen|…") har också åtgärd och grupp som fritext. Den finns tills den tas bort.
const HP_EGEN_FALT = ['atgard', 'grupp'];
const HP_MAX_TEXT = 500;
export const _hpArEgen = nyckel => typeof nyckel === 'string' && nyckel.startsWith('egen|');

/** Gruppen som raden gäller, i samma form för alla rader: "403010 Barnskötare · BAS C". */
function _hpGrupp(aid, namn, bas) {
    const a = aid == null ? '' : String(aid).trim();
    const n = namn == null ? '' : String(namn).trim();
    const yrke = !n || n === a ? a : (a && !n.startsWith(a) ? `${a} ${n}` : n);
    return `${yrke} · BAS ${bas}`;
}

/** Radens nyckel i state.handlingsplan: källa, yrke och BAS (för ett par också jämförelseyrket). */
function _hpNyckel(kalla, ...delar) { return [kalla, ...delar.map(d => d == null ? '' : String(d))].join('|'); }

/** De ifyllda värdena för en rad (tomma strängar när inget är ifyllt). Raden kan ha försvunnit ur underlaget;
 *  värdena ligger då kvar i minnet tills Rensa all data. De sakliga skälen (`skal`, src/lib/sakligaskal.js) står med
 *  bara när raden har minst ett, som en kopia. */
export function _hpVarden(nyckel) {
    const v = (state.handlingsplan && state.handlingsplan[nyckel]) || {};
    return { sakligt: v.sakligt || '', ansvarig: v.ansvarig || '', tidsplan: v.tidsplan || '', status: v.status || '',
             ...(_hpArEgen(nyckel) ? { egen: true, atgard: v.atgard || '', grupp: v.grupp || '' } : {}),
             ...(Array.isArray(v.skal) && v.skal.length ? { skal: v.skal.map(x => ({ ...x })) } : {}) };
}
/** Raden har något ifyllt: ett av fälten eller minst ett sakligt skäl. */
const _hpHarIfyllt = rad => HP_FALT.some(f => rad[f]) || !!(rad.skal && rad.skal.length);

export function _hpSatt(nyckel, falt, varde) {
    const egen = _hpArEgen(nyckel);
    if (!nyckel || !(HP_FALT.includes(falt) || (egen && HP_EGEN_FALT.includes(falt)))) return;
    if (!state.handlingsplan) state.handlingsplan = {};
    const rad = { ..._hpVarden(nyckel), [falt]: String(varde ?? '').slice(0, HP_MAX_TEXT) };
    // En förifylld rad glöms när alla fält är tomma och den saknar skäl; en egen rad finns tills den tas bort.
    if (!egen && !_hpHarIfyllt(rad)) delete state.handlingsplan[nyckel];
    else state.handlingsplan[nyckel] = rad;
}

/**
 * Sätter radens sakliga skäl. Listan prövas som i konfigurationsfilen (valideraSkal): ett ogiltigt skäl lagras inte.
 * Svarar med antalet som inte lagrades.
 * @param {string} nyckel
 * @param {any[]} lista
 */
export function _hpSattSkal(nyckel, lista) {
    if (!nyckel) return 0;
    const { skal, bort } = valideraSkal(lista);
    if (!state.handlingsplan) state.handlingsplan = {};
    const rad = _hpVarden(nyckel);
    delete rad.skal;
    if (skal.length) rad.skal = skal;
    if (!_hpArEgen(nyckel) && !_hpHarIfyllt(rad)) delete state.handlingsplan[nyckel];
    else state.handlingsplan[nyckel] = rad;
    return bort;
}

/** Lägger till en egen rad sist i tabellen och sätter fokus i dess första fält. */
function _hpLaggTillEgen() {
    if (!state.handlingsplan) state.handlingsplan = {};
    const nyckel = _hpNyckel('egen', Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    state.handlingsplan[nyckel] = { egen: true, atgard: '', grupp: '', sakligt: '', ansvarig: '', tidsplan: '', status: '' };
    ritaHandlingsplan();
    const forsta = [...document.querySelectorAll('#handlingsplan-tbody .hp-falt')].find(el => /** @type {HTMLElement} */ (el).dataset.hpNyckel === nyckel);
    if (forsta) /** @type {HTMLElement} */ (forsta).focus();
    return nyckel;
}
function _hpTaBortEgen(nyckel) {
    if (!_hpArEgen(nyckel) || !state.handlingsplan || !state.handlingsplan[nyckel]) return;
    delete state.handlingsplan[nyckel];
    ritaHandlingsplan();
    meddelaSkarmlasare('Raden är borttagen.');
}

/** Raderna i handlingsplanen: de förifyllda från Prioritering och Likvärdigt arbete, sedan de egna. `baraEgna` hoppar
 *  över förifyllningen (utan underlag). */
export function _handlingsplanForifyllning({ baraEgna = false } = {}) {
    const rows = [], nycklar = [], skillnader = [], minsta = [];
    let prioCount = 0, lvCount = 0, parUtelamnade = 0;
    // En rad: [åtgärd, grupp, underlag, sakligt skäl, kostnad, ansvarig, tidsplan, status, antal berörda] — med det som
    // fyllts i på fliken. Antal berörda är gruppens antal (för ett kandidatpar det kvinnodominerade yrkets), null för en egen rad.
    // skillnader: gruppens medianskillnad i kr/mån per rad (de sakliga skälens andelar räknas mot den), null för en egen rad.
    // minsta: den minsta gruppen bakom skillnaden (för prioriteringen det mindre könet, för ett kandidatpar den mindre av
    // yrkesgrupperna, parMinstaGrupp: mot en rad ur statistiken kvinnogruppen), som årsbokslutet prövar mot minsta
    // gruppstorlek; null för en egen rad.
    const lagg = (nyckel, atgard, grupp, underlag, kostnad, antal, skillnad, nMin) => {
        const v = _hpVarden(nyckel);
        rows.push([atgard, grupp, underlag, v.sakligt, kostnad, v.ansvarig, v.tidsplan, v.status, antal == null ? null : antal]);
        nycklar.push(nyckel);
        skillnader.push(skillnad == null ? null : skillnad);
        minsta.push(Number.isFinite(nMin) ? nMin : null);
    };
    if (!baraEgna) try {
        const ref = _valdPrioReferens();
        const hasRef = ref === 'stallningstagande' ? state.policy.length : state.statistik.length;
        if (hasRef) {
            const thr = (state.prioConfig && state.prioConfig.atgardThreshold != null) ? state.prioConfig.atgardThreshold : -5;
            raknaPrioritering(ref).filter(i => i.diffPct < thr).forEach(i => {
                lagg(_hpNyckel('prio', i.aid || i.yrke, i.bas), 'Granska löneläge och väg mot sakliga skäl', _hpGrupp(i.aid, i.yrke, i.bas), HP_UNDERLAG_PRIO, Math.round(i.annualGapTotal), i.n, gruppSkillnadKr(i, kInstalld()), Math.min(i.kvN, i.maN));
                prioCount++;
            });
        }
    } catch (e) { rapporteraFel('Handlingsplan: prioriteringen', e); }
    if (!baraEgna) try {
        if (state.statistik.length || state.data.length) {
            const lv = likvardighetResultat();
            // Minsta gruppstorlek: par med en grupp under tröskeln förifylls inte (undantaget gäller bara fliken)
            const { par, utelamnade } = _parForRedovisning(lv && lv.pairs);
            parUtelamnade = utelamnade;
            par.forEach(p => {
                const arsKostnad = Math.round(periodkostnad(Math.abs(p.gapKr) * (p.kvN || 1), state.costSettings));
                lagg(_hpNyckel('par', p.kvAid, p.kvBas, p.maAid, p.maBas), 'Granska likvärdigt arbete (kvinnodominerad)', _hpGrupp(p.kvAid, p.kvLabel, p.kvBas), HP_UNDERLAG_PAR, arsKostnad, p.kvN, isFinite(p.gapKr) ? Math.round(p.gapKr) : null, parMinstaGrupp(p));
                lvCount++;
            });
        }
    } catch (e) { rapporteraFel('Handlingsplan: likvärdigt arbete', e); }
    // Egna rader sist, i den ordning de lades till. Ingen kostnad räknas: raden är användarens egen.
    let egenCount = 0;
    Object.keys(state.handlingsplan || {}).filter(_hpArEgen).forEach(nyckel => {
        const v = _hpVarden(nyckel);
        rows.push([v.atgard || '', v.grupp || '', HP_UNDERLAG_EGEN, v.sakligt, null, v.ansvarig, v.tidsplan, v.status, null]);
        nycklar.push(nyckel);
        skillnader.push(null);
        minsta.push(null);
        egenCount++;
    });
    return { rows, nycklar, skillnader, minsta, prioCount, lvCount, egenCount, parUtelamnade, parNot: _parUtelamnadeNot(parUtelamnade) };
}

/**
 * Kolumnen Kostnaden avser: vilken kostnad raden har, härledd ur dess underlag (inget eget fält, och inget i
 * konfigurationsfilen). Rader ur Prioritering har kostnaden att lyfta gruppen till referensens median, kandidatpar
 * kostnaden att lyfta det kvinnodominerade yrket till jämförelseyrkets median; en egen rad har ingen beräknad kostnad
 * och får en tom cell. Enda källan till orden: fliken, Excel, utskriften, rapportmodellen och rapportunderlaget.
 * @param {string} underlag
 */
export function _hpKostnadAvser(underlag) {
    return underlag === HP_UNDERLAG_PRIO ? 'Nå referensens median' : underlag === HP_UNDERLAG_PAR ? `Nå ${genitiv(T.jamforelse.bf)} median` : '';
}

// Ett fritextfält som liknar ett personnummer får en varning; texten står kvar.
export function _hpLiknarPersonuppgift(t) { return !!t && liknarPersonuppgift(t); }
function _hpUppdateraVarning() {
    const tbody = document.getElementById('handlingsplan-tbody');
    const varning = document.getElementById('handlingsplan-varning');
    if (!tbody || !varning) return;
    let traff = 0;
    tbody.querySelectorAll('input.hp-falt').forEach(el => {
        const liknar = _hpLiknarPersonuppgift(/** @type {HTMLInputElement} */ (el).value);
        el.classList.toggle('hp-falt-varning', liknar);
        if (liknar) { el.setAttribute('aria-describedby', 'handlingsplan-varning'); traff++; } else el.removeAttribute('aria-describedby');
    });
    varning.hidden = !traff;
}

/** Radens skäl i korthet: antal och förklarad andel (andelen bara mot en skillnad över 0), eller null utan skäl. */
function _hpSkalKort(nyckel, skillnadKr) {
    const sk = _hpVarden(nyckel).skal;
    if (!sk || !sk.length) return null;
    const s = skalSammanstallning(sk, skillnadKr);
    return { antal: s.antal, andel: s.forklaradAndel != null ? svPct(s.forklaradAndel * 100, 0) : null };
}
/** Texten på knappen Sakliga skäl: "Sakliga skäl: inga", "Sakliga skäl (2)" eller "Sakliga skäl (2) · 65 % förklarat". */
export function _hpSkalSammanfattning(nyckel, skillnadKr) {
    const k = _hpSkalKort(nyckel, skillnadKr);
    if (!k) return 'Sakliga skäl: inga';
    return `Sakliga skäl (${k.antal})${k.andel ? ` · ${k.andel} förklarat` : ''}`;
}
/** Knappens tillgängliga namn: den synliga sammanfattningen först (WCAG 2.5.3), sedan gruppen. */
export function _hpSkalEtikett(nyckel, grupp, skillnadKr) {
    return `${_hpSkalSammanfattning(nyckel, skillnadKr)}, ${grupp}`;
}
/** Knappen som öppnar dialogen med radens sakliga skäl (57-sakliga-skal.js). Syns inte på utskriften. */
function _hpSkalKnapp(nyckel, grupp, skillnadKr) {
    return `<button type="button" class="btn-table-tool hp-skal" data-hp-skal="${esc(nyckel)}" data-hp-grupp="${esc(grupp)}" data-hp-skillnad="${skillnadKr == null ? '' : esc(String(skillnadKr))}" data-noprint aria-label="${esc(_hpSkalEtikett(nyckel, grupp, skillnadKr))}">`
        + `<span class="hp-skal-sammanfattning">${esc(_hpSkalSammanfattning(nyckel, skillnadKr))}</span></button>`;
}

/**
 * Bedömningarna i handlingsplanen för en grupp, för läs-raden i gruppdossiern och BAS-dossiern (80, 81): en post per
 * förifylld rad som `passar` (nyckelns delar), med antal skäl och förklarad andel. Dossiererna dokumenterar inte skäl
 * själva; raden pekar på bedömningen här.
 * @param {(delar: string[]) => string|boolean} passar
 */
export function _hpBedomningar(passar) {
    const seed = _handlingsplanForifyllning({ baraEgna: !hamtaData().length });
    return seed.nycklar.map((nyckel, i) => ({ nyckel, i, roll: _hpArEgen(nyckel) ? '' : passar(nyckel.split('|')) })).filter(x => x.roll)
        .map(({ nyckel, i, roll }) => {
            const s = skalSammanstallning(_hpVarden(nyckel).skal || [], seed.skillnader[i]);
            return { nyckel, grupp: seed.rows[i][1], kalla: nyckel.split('|')[0], roll, antal: s.antal, summa: s.summa, andel: s.forklaradAndel };
        });
}
/**
 * Hör handlingsplanens rad (nyckelns delar) till gruppdossierns grupp? 'grupp' för prioriteringens rad och för ett
 * kandidatpar där gruppen är det kvinnodominerade yrket, 'jamforelse' för ett kandidatpar där gruppen är
 * jämförelseyrket, annars ''. Prioriteringens nyckel bär AID-koden eller, utan kod, yrket (`i.aid || i.yrke`), så
 * båda prövas.
 * @param {string[]} delar
 * @param {string} aid
 * @param {string} yrke
 * @param {string} bas
 */
export function _hpPassarGrupp(delar, aid, yrke, bas) {
    const [kalla, a1, b1, a2, b2] = delar;
    const ar = (a, b) => (a === aid || a === yrke) && b === bas;
    if (kalla === 'prio') return ar(a1, b1) ? 'grupp' : '';
    if (kalla === 'par') return ar(a1, b1) ? 'grupp' : ar(a2, b2) ? 'jamforelse' : '';
    return '';
}
/** Läs-raden för en bedömning: "Bedömning i handlingsplanen: 3 skäl, 80 % av skillnaden förklarad". */
function _hpBedomningText(b) {
    const vad = !b.antal ? 'inga sakliga skäl angivna ännu'
        : `${b.antal} skäl, ${b.andel != null ? `${svPct(b.andel * 100, 0)} av skillnaden förklarad` : `${svTal(b.summa, 0)} kr/mån`}`;
    return `Bedömning i handlingsplanen: ${vad}`;
}
/** Läs-raderna som HTML med länk till raden i Handlingsplan, eller tom sträng utan rader. `medGrupp`: gruppen först. */
export function _hpBedomningHtml(lista, { medGrupp = false } = {}) {
    if (!lista.length) return '';
    const markning = b => (b.kalla !== 'par' ? '' : b.roll === 'jamforelse' ? ` (kandidatpar, ${T.jamforelse.en})` : ' (kandidatpar)');
    return `<ul class="gd-list hp-bedomningar">${lista.map(b => `<li>${medGrupp ? `${esc(b.grupp)}${markning(b)}: ` : ''}${esc(_hpBedomningText(b))}. `
        + `<a href="#" data-hp-ga-till="${esc(b.nyckel)}" aria-label="${esc(`Gå till raden i Handlingsplan: ${b.grupp}`)}">Gå till raden</a></li>`).join('')}</ul>`;
}
/** Visar raden i Handlingsplan med fokus på dess knapp Sakliga skäl. */
export function _hpGaTillRad(nyckel) {
    navigeraTill('handlingsplan');
    const fokus = () => {
        const b = [...document.querySelectorAll('#handlingsplan-tbody [data-hp-skal]')].find(el => /** @type {HTMLElement} */ (el).dataset.hpSkal === nyckel);
        if (b) { /** @type {HTMLElement} */ (b).focus(); b.scrollIntoView?.({ block: 'center' }); }
    };
    fokus();
    setTimeout(fokus, 120);   // fliken kan sätta fokus själv efter bytet
}

/**
 * De sakliga skälen för exporterna (skalUnderlag, src/lib/sakligaskal.js): förifyllningens rader med skäl, i tabellens
 * ordning. Bygger på förifyllningen, så en rad som inte finns i underlaget (i exportläget: en grupp under tröskeln)
 * inte följer med. `seed` återanvänder en förifyllning som redan är räknad.
 * @param {ReturnType<typeof _handlingsplanForifyllning>} [seed]
 */
export function _hpSkalUnderlag(seed) {
    const s = seed || _handlingsplanForifyllning();
    return skalUnderlag(s.nycklar.map((nyckel, i) => ({ nyckel, grupp: s.rows[i][1] || 'Egen rad', underlag: s.rows[i][2], antal: s.rows[i][8], nMin: s.minsta[i],
        skillnadKr: s.skillnader[i], egen: _hpArEgen(nyckel), skal: _hpVarden(nyckel).skal || [] })), kInstalld());
}
/** Noten i exporterna där belopp, andel och kommentar utelämnas (src/lib/sakligaskal.js). */
export const HP_SKAL_UTAN_BELOPP = SKAL_UTAN_BELOPP;
/** Står raden utan belopp i exporterna (skalUtanBelopp, src/lib/sakligaskal.js)? */
export function _hpUtanBelopp(nyckel, nMin) { return skalUtanBelopp({ egen: _hpArEgen(nyckel), nMin }, kInstalld()); }
/** Radens skäl som text för exporterna: "Marknad 800 kr; Erfarenhet 400 kr"; utan belopp bara kategorierna med noten. */
function _hpSkalText(skal) {
    const lista = skal || [];
    if (lista.length && lista.every(s => s.belopp == null)) return `${lista.map(s => s.namn || s.kategori).join('; ')} (${HP_SKAL_UTAN_BELOPP})`;
    return lista.map(s => `${s.namn || s.kategori} ${svTal(s.belopp, 0)} kr`).join('; ');
}

// Demots exempel på sakliga skäl (andel av gruppens skillnad, eller belopp när gruppen saknar skillnad), så att
// tabellerna i rapporten och Excel syns. Påhittade, utan siffror i kommentarerna.
const HP_DEMO_SKAL = [
    [['marknad', 0.4, 'Exempel i demot: svårrekryterat yrke i regionen'], ['erfarenhet', 0.25, 'Exempel i demot: längre yrkeserfarenhet']],
    [['overgang', 0.5, 'Exempel i demot: lön som följde med vid en omorganisation']],
    [['utbildning', 0.3, 'Exempel i demot: vidareutbildning utöver kraven'], ['prestation', 0.2, 'Exempel i demot: bedömning enligt lönekriterierna']],
];
/** Nycklarna där demot skrev skäl: de tas bort när en riktig lönefil läses in (_efterInlastData, 32-filinlasning.js). */
export const _hpDemoNycklar = new Set();
/** Tar bort skälen som demot skrev, och raden om inget annat är ifyllt. Övriga rader och egna rader rörs inte. */
export function _hpRensaDemoSkal() {
    for (const nyckel of _hpDemoNycklar) {
        const rad = state.handlingsplan && state.handlingsplan[nyckel];
        if (!rad) continue;
        delete rad.skal;
        if (!_hpArEgen(nyckel) && !_hpHarIfyllt(rad)) delete state.handlingsplan[nyckel];
    }
    _hpDemoNycklar.clear();
}
/** Förifyller demots skäl på tre rader som följer med i exporterna: rader med en medianskillnad först. Rör inte rader som redan har skäl. */
export function _hpDemoSkal() {
    const seed = medExportLage(() => _handlingsplanForifyllning());
    const kand = seed.nycklar.map((nyckel, i) => ({ nyckel, s: seed.skillnader[i] })).filter(x => !_hpArEgen(x.nyckel));
    const ordning = [...kand.filter(x => x.s > 0), ...kand.filter(x => !(x.s > 0))].slice(0, HP_DEMO_SKAL.length);
    ordning.forEach(({ nyckel, s }, j) => {
        if ((_hpVarden(nyckel).skal || []).length) return;
        _hpDemoNycklar.add(nyckel);
        _hpSattSkal(nyckel, HP_DEMO_SKAL[j].map(([kategori, andel, kommentar]) => ({ kategori, kommentar,
            belopp: s > 0 ? Math.round(s * Number(andel) / 100) * 100 : Math.round(Number(andel) * 2000 / 100) * 100 })));
    });
}

// #UX Renderar de förifyllda raderna direkt i skärm-mallen, med fält för sakligt skäl, ansvarig, tidsplan och status,
// ovanför tomrader som syns på utskriften — så HR ser underlaget och kan fylla i planen utan att först exportera.
export function ritaHandlingsplan() {
    // Samverkansknapparna (kortet Samverkan & uppföljning) exporterar underlag — inaktiva tills data finns.
    document.querySelectorAll('[data-dok-klick]').forEach(b => { /** @type {HTMLInputElement} */ (b).disabled = !hamtaData().length; });
    const tbody = document.getElementById('handlingsplan-tbody');
    if (!tbody) return;
    const period = document.getElementById('hp-kostnad-period');
    if (period) period.textContent = `(kr/${periodOrd(state.costSettings)})`;   // kostnaden gäller beräkningsperioden
    const seed = _handlingsplanForifyllning({ baraEgna: !hamtaData().length });
    const fmtKr = n => (n ? svKr(n) : '');
    const lista = (id, nyckel, falt, val, alt, etikett) => `<select id="${id}" class="form-select hp-falt" data-hp-nyckel="${esc(nyckel)}" data-hp-falt="${falt}" aria-label="${esc(etikett)}">`
        + alt.map(([v, l]) => `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${esc(l)}</option>`).join('') + '</select>';
    const text = (id, nyckel, falt, val, platshallare, etikett) => `<input type="text" id="${id}" class="hp-falt" data-hp-nyckel="${esc(nyckel)}" data-hp-falt="${falt}" value="${esc(val)}"`
        + ` maxlength="${HP_MAX_TEXT}" autocomplete="off" placeholder="${esc(platshallare)}" aria-label="${esc(etikett)}">`;
    const seededHtml = seed.rows.map((r, i) => {
        const n = seed.nycklar[i], egen = _hpArEgen(n), g = r[1] || (egen ? 'egen rad' : '');
        // Skärmen samlar det som bara visas (åtgärd, grupp, antal berörda, underlag) i första cellen, så att fälten man fyller
        // i ryms utan sidledsrullning. Kolumnerna Grupp, Antal berörda och Underlag finns kvar för utskriften
        // (hp-bara-utskrift) och undertexten i första cellen följer inte med dit (hp-bara-skarm), så utskriften har en
        // kolumn för var och en. En egen rad har åtgärd och grupp som fält och en knapp som tar bort raden; gruppfältet står i
        // första cellen och speglas i utskriftens gruppkolumn (_hpSpegla). Antal berörda står efter gruppen; en egen rad
        // har inget antal.
        const antal = `<td class="t-hoger hp-bara-utskrift">${r[8] != null ? esc(String(r[8])) : ''}</td>`;
        // BAS och bokstaven hålls ihop med ett hårt mellanslag på skärmen och i utskriften; exporterna
        // och fältens etiketter har ett vanligt.
        const gruppHtml = esc(g).replace(/ · BAS (\S+)$/, ' · BAS&nbsp;$1');
        const under = innehall => `<span class="hp-under hp-bara-skarm" data-noprint>${innehall}</span>`;
        const forsta = egen
            ? `<td>${text(`hp-${i}-atgard`, n, 'atgard', r[0], 'Vad ska göras?', 'Åtgärd, egen rad')}`
              + under(`${text(`hp-${i}-grupp`, n, 'grupp', r[1], `Grupp eller ${T.enhet.en}, inga namn`, 'Berörd grupp, egen rad')}`
                + `<span class="hp-under-rad">${esc(r[2])} <button type="button" class="btn-table-tool hp-ta-bort" data-hp-ta-bort="${esc(n)}" aria-label="Ta bort den egna raden">Ta bort</button></span>`) + '</td>'
              + `<td class="hp-bara-utskrift"><span data-hp-spegel="${esc(n)}">${esc(r[1])}</span></td>${antal}<td class="hp-bara-utskrift">${esc(r[2])}</td>`
            : `<td><span class="hp-atgard">${esc(r[0])}</span>`
              + under(`<span class="hp-under-rad">${gruppHtml}${r[8] != null ? ` · ${esc(String(r[8]))}&nbsp;berörda` : ''}</span><span class="hp-under-rad">Underlag: ${esc(r[2])}</span>`) + '</td>'
              + `<td class="hp-bara-utskrift">${gruppHtml}</td>${antal}<td class="hp-bara-utskrift">${esc(r[2])}</td>`;
        return `<tr class="handlingsplan-seeded${egen ? ' handlingsplan-egen' : ''}">${forsta}`
            + `<td>${lista(`hp-${i}-sakligt`, n, 'sakligt', r[3], HP_SAKLIGT, `Sakliga skäl prövade?: ${g}`)} ${_hpSkalKnapp(n, g, seed.skillnader[i])}</td>`
            + `<td class="t-hoger">${esc(fmtKr(r[4]))}</td><td>${esc(_hpKostnadAvser(r[2]))}</td>`
            + `<td>${text(`hp-${i}-ansvarig`, n, 'ansvarig', r[5], 'Roll', `Ansvarig: ${g}`)}</td>`
            + `<td>${text(`hp-${i}-tidsplan`, n, 'tidsplan', r[6], 'Månad, år', `Tidsplan: ${g}`)}</td>`
            + `<td>${lista(`hp-${i}-status`, n, 'status', r[7], HP_STATUS, `Status: ${g}`)}</td></tr>`;
    }).join('');
    const emptyN = Math.max(5, 8 - seed.rows.length);
    const emptyHtml = Array.from({ length: emptyN }, () =>
        '<tr class="handlingsplan-empty"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
    tbody.innerHTML = seededHtml + emptyHtml;
    _hpUppdateraVarning();
    const note = document.getElementById('handlingsplan-seed-note');
    if (note) {
        const parNot = seed.parNot ? ` ${esc(seed.parNot)}` : '';
        const forifyllda = seed.rows.length - seed.egenCount;
        const egna = seed.egenCount ? ` ${seed.egenCount === 1 ? 'En egen rad' : `${seed.egenCount} egna rader`} står sist.` : '';
        note.innerHTML = (forifyllda
            ? `Förifyllt med <strong>${forifyllda}</strong> rad${forifyllda === 1 ? '' : 'er'} (${seed.prioCount} från Prioritering, under referensen, och ${seed.lvCount} kandidatpar från Likvärdigt arbete) — ett utgångsläge att granska. Fyll i sakligt skäl, ansvarig, tidsplan och status direkt i raderna.`
            : 'Mallen förifylls automatiskt med grupperna från Prioritering och Likvärdigt arbete när data och referens finns. Lägg till egna rader med knappen under tabellen, eller läs in ställningstagandet eller jämförelsestatistiken i <strong>Filer och kvalitet</strong>.') + egna + parNot;
    }
}

/** En egen rads grupp står i ett fält i första cellen på skärmen och som text i utskriftens gruppkolumn. */
function _hpSpegla(nyckel, varde) {
    const el = [...document.querySelectorAll('#handlingsplan-tbody [data-hp-spegel]')].find(s => /** @type {HTMLElement} */ (s).dataset.hpSpegel === nyckel);
    if (el) el.textContent = varde;
}

/** Det ifyllda i konfigurationsfilen: en post per rad med något ifyllt (också bara sakliga skäl). */
export function _hpForKonfiguration() {
    return Object.keys(state.handlingsplan || {}).map(nyckel => {
        const r = { nyckel, ..._hpVarden(nyckel) };
        if (_hpDemoNycklar.has(nyckel)) delete r.skal;   // demots exempelskäl är inte användarens och skrivs aldrig till filen
        return r;
    }).filter(r => r.egen || _hpHarIfyllt(r));
}
/**
 * Prövar konfigurationsfilens poster; kastar vid fel form. Okända val i rullistorna läses som tomma. Sakliga skäl som
 * inte går att läsa (valideraSkal) faller bort, och antalet läggs som en varning i `varningar` när listan ges.
 * @param {any} lista
 * @param {string[]} [varningar]
 */
export function _hpValideraKonfiguration(lista, varningar) {
    if (!Array.isArray(lista)) throw new Error('handlingsplan måste vara en array.');
    /** @type {{[nyckel: string]: any}} */ const ut = {};
    let skalBort = 0;
    lista.forEach((r, i) => {
        if (!r || typeof r !== 'object') throw new Error(`handlingsplan[${i}] är inte ett objekt.`);
        if (typeof r.nyckel !== 'string' || !r.nyckel || r.nyckel.length > 300) throw new Error(`handlingsplan[${i}].nyckel måste vara en sträng (högst 300 tecken).`);
        const egen = _hpArEgen(r.nyckel);
        [...HP_FALT, ...(egen ? HP_EGEN_FALT : [])].forEach(f => { if (r[f] != null && typeof r[f] !== 'string') throw new Error(`handlingsplan[${i}].${f} måste vara en sträng.`); });
        const giltig = (v, alt) => alt.some(([a]) => a === v) ? v : '';
        /** @type {any} */ const rad = { sakligt: giltig(r.sakligt || '', HP_SAKLIGT), ansvarig: String(r.ansvarig || '').slice(0, HP_MAX_TEXT),
            tidsplan: String(r.tidsplan || '').slice(0, HP_MAX_TEXT), status: giltig(r.status || '', HP_STATUS),
            ...(egen ? { egen: true, atgard: String(r.atgard || '').slice(0, HP_MAX_TEXT), grupp: String(r.grupp || '').slice(0, HP_MAX_TEXT) } : {}) };
        const { skal, bort } = valideraSkal(r.skal);
        skalBort += bort;
        if (skal.length) rad.skal = skal;
        if (egen || _hpHarIfyllt(rad)) ut[r.nyckel] = rad;
    });
    if (skalBort && varningar) varningar.push(`${skalBort} ${skalBort === 1 ? 'sakligt skäl' : 'sakliga skäl'} i filens handlingsplan gick inte att läsa och hoppas över.`);
    return ut;
}

// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
export function exportHandlingsplan(...a) { return medExportLage(() => _exportHandlingsplanExport.apply(null, /** @type {any} */ (a))); }
function _exportHandlingsplanExport() {
    const header = ['Åtgärd', `Grupp (${T.enhet.en} och ${T.niva.en})`, 'Antal berörda', 'Underlag', 'Sakliga skäl prövade?', `Beräknad kostnad (kr/${periodOrd(state.costSettings)}, inkl. PO)`, 'Kostnaden avser', 'Ansvarig', 'Tidsplan (senast inom tre år)', 'Status',
        'Sakliga skäl (kategori och belopp)', 'Förklarad andel av skillnaden (%)'];
    const seed = _handlingsplanForifyllning();
    const prioCount = seed.prioCount, lvCount = seed.lvCount;
    // Bladets kolumner i skärmens ordning: Antal berörda efter gruppen (tomt för en egen rad), Kostnaden avser efter
    // kostnaden (tomt för en egen rad). Sist de sakliga skälen ("Marknad 800 kr; Erfarenhet 400 kr") och hur stor andel
    // av gruppens medianskillnad de förklarar.
    const rows = seed.rows.map((r, i) => {
        const sum = skalForRad(_hpVarden(seed.nycklar[i]).skal || [], { egen: _hpArEgen(seed.nycklar[i]), nMin: seed.minsta[i], skillnadKr: seed.skillnader[i] }, kInstalld()).sammanstallning;
        return [r[0], r[1], r[8] != null ? r[8] : '', ...r.slice(2, 5), _hpKostnadAvser(r[2]), ...r.slice(5, 8), _hpSkalText(sum.skal), sum.antal && sum.forklaradAndel != null ? Math.round(sum.forklaradAndel * 1000) / 10 : ''];
    });
    for (let i = 0; i < 5; i++) rows.push(header.map(() => ''));   // tomma rader för manuella tillägg

    const guide = [
        ['Handlingsplan för jämställda löner — vägledning', ''],
        ['Lagrum', 'Diskrimineringslagen 3 kap.: åtgärder, kostnadsberäkning och tidsplan i dokumentationen av lönekartläggningen'],
        ['Lagen', 'Åtgärder, kostnadsberäkning och tidsplan ska stå i dokumentationen av lönekartläggningen.'],
        ['Tidsplan', 'Åtgärderna ska genomföras så snart som möjligt, dock senast inom tre år.'],
        ['Inte inom tre år', 'Kan en åtgärd inte genomföras inom tre år, skriv varför och när den kan genomföras.'],
        ['Dokumentation', 'Kartläggningen, analysen och åtgärderna ska dokumenteras skriftligt.'],
        ['Samverkan', 'Arbetet ska göras i samverkan med arbetstagarna (lagen).'],
        ['', ''],
        ['Detta underlag', `Förifyllt med ${prioCount} grupp(er) under referens (Prioritering) och ${lvCount} kandidatpar i likvärdigt arbete.${seed.parNot ? ' ' + seed.parNot : ''}${seed.egenCount ? ` ${seed.egenCount} egna rader från fliken står sist.` : ''} Det som fyllts i på fliken Handlingsplan står med; fyll i resten av sakligt skäl, ansvarig, tidsplan och status. Raderna bygger på gruppmått — inga individdata.`],
        ['Kostnad att nå referensen', `Kostnaden för raderna ur Prioritering: vad det kostar att lyfta gruppen till referensens median. Det är löneläget mot er referens, inte lönekartläggningens könsskillnader. För kandidatparen är det kostnaden att lyfta ${termFras(T.enhet, 'bf', { adjektiv: 'kvinnodominerad' })} till ${genitiv(T.jamforelse.bf)} median. Kolumnen Kostnaden avser säger vilken av dem raden har.`],
        ['OBS', 'Det här är ett underlag. Du skriver dokumentationen i Word-utkastet.']
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), 'Handlingsplan');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(guide), 'Vägledning');
    _laggTillMetodblad(wb);
    XLSX.writeFile(wb, demoFilnamn(`handlingsplan_underlag_${idagDatum()}.xlsx`));
    _visaExportvarning();
    meddelaSkarmlasare('Handlingsplansunderlag exporterat.');
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartHandlingsplan() {
    // Fälten skriver till state.handlingsplan medan man skriver; tabellen ritas inte om (fokus står kvar).
    ['input', 'change'].forEach(typ => document.getElementById('handlingsplan-tbody')?.addEventListener(typ, e => {
        const el = /** @type {HTMLInputElement} */ (e.target);
        if (!el || !el.classList || !el.classList.contains('hp-falt')) return;
        _hpSatt(el.dataset.hpNyckel, el.dataset.hpFalt, el.value);
        if (el.dataset.hpFalt === 'grupp') _hpSpegla(el.dataset.hpNyckel, el.value);
        if (el.tagName === 'INPUT') _hpUppdateraVarning();
    }));
    document.getElementById('handlingsplan-tbody')?.addEventListener('click', e => {
        const btn = /** @type {HTMLElement} */ (e.target).closest('[data-hp-ta-bort]');
        if (btn) _hpTaBortEgen(btn.getAttribute('data-hp-ta-bort'));
    });
    document.getElementById('btn-hp-lagg-till')?.addEventListener('click', () => _hpLaggTillEgen());
    document.getElementById('btn-export-handlingsplan')?.addEventListener('click', exportHandlingsplan);
}

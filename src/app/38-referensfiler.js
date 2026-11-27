// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
import { _normaliseraBas, _normaliseraPolicyAid, dubbletterAidBas, tolkaStatistikfil, tolkaTal } from '../lib/inlasning.js';
import { namnFranFil } from '../lib/referens.js';
import { esc } from './01-html-och-tillganglighet.js';
import { hamtaFalt, doljLaddning, visaLaddning } from './03-hjalpfunktioner.js';
import { _kopplaNamnFalt } from './07-standardinstallningar.js';
import { T } from './09-termer.js';
import { aterstallReferens, hamtaData, harReferens, referensKalla, referensNamn, ritaOmReferens, sattReferensNamn, state } from './12-tillstand.js';
import { ritaKartlaggningensSteg, ritaKravstatus } from './13-oversikt.js';
import { ritaKonsistenskontroll } from './16-inlasningskontroll.js';
import { ritaAtgardslista } from './18-atgardslista.js';
import { ritaPaketinfo, uppdateraPaketKnapp } from './29-organisationspaket.js';
import { markeraFilrutaInlast, lasTabellfil, ritaFilrutor, aterstallFilruta } from './32-filinlasning.js';
import { ritaLoneoversikt } from './39-loneoversikt.js';

// Beskedet om rader med samma AID och BAS i en referensfil: uppslaget (policyFor, statistikFor) tar den första.
function _dubblettBesked(n) {
    return n ? ` · ${n} ${n === 1 ? 'rad har' : 'rader har'} samma AID och BAS som en tidigare rad; den första används` : '';
}

// ---- File Upload: Policy CSV ----
// Läser in ett eget ställningstagande (redan tolkade rader) och namnger det efter
// filen (ADR-28). Returnerar antal giltiga rader; 0 = inget ändrat. En rad med ett negativt värde läses inte, som i
// organisationspaketet.
function _lasInReferens(rader, filnamn) {
    const policy = rader.map(row => ({
        aid: _normaliseraPolicyAid(row.aid ?? hamtaFalt(row, ["aidkod","aid","yrkeskod","befattningskod"])),
        bas: _normaliseraBas(row.bas ?? hamtaFalt(row, ["bas","basintervall"])),
        p10: typeof row.p10 === 'number' ? row.p10 : tolkaTal(hamtaFalt(row, ["10e","p10","10"])),
        med: typeof row.med === 'number' ? row.med : tolkaTal(hamtaFalt(row, ["median","med"])),
        p90: typeof row.p90 === 'number' ? row.p90 : tolkaTal(hamtaFalt(row, ["90e","p90","90"]))
    })).filter(p => (p.bas || p.aid) && p.p10 >= 0 && p.med >= 0 && p.p90 >= 0);
    if (!policy.length) return 0;
    state.policy = policy;
    state.policyKalla = 'fil';
    const namn = namnFranFil(filnamn);
    state.policyNamn = namn;
    state.policyKortnamn = namn;
    ritaReferensKort();
    ritaPaketinfo(); uppdateraPaketKnapp();
    return policy.length;
}

// Referenskortet i Filer och kvalitet: vilken referens som används, namnfält för egen fil
// och knappen som tar bort den.
export function ritaReferensKort() {
    const el = document.getElementById('referens-status');
    if (!el) return;
    const har = harReferens();
    el.innerHTML = har
        ? `Används: <strong>${esc(referensNamn())}</strong>${esc(referensKalla())}`
        : '<strong>Ingen referens inläst.</strong><br><span class="text-dampad-xs">Läs in organisationens lönepolitiska ställningstagande eller organisationspaketet.</span>';
    const falt = document.getElementById('referens-namn-rad');
    const input = document.getElementById('referens-namn');
    const aterga = document.getElementById('btn-referens-aterga');
    const egen = har && state.policyKalla === 'fil';
    // Namnet får ändras både för en egen fil och för ett inläst paket (paketet kan bära ett filnamn som
    // systemförvaltaren inte bytte); borttagning gäller bara egen fil — paketets delar tas bort med paketet.
    const namnges = har && (state.policyKalla === 'fil' || state.policyKalla === 'paket');
    if (falt) falt.hidden = !namnges;
    if (input && document.activeElement !== input) /** @type {HTMLInputElement} */ (input).value = namnges ? referensNamn() : '';
    if (aterga) { aterga.hidden = !egen; aterga.textContent = 'Ta bort referensen'; }
}
const policyFilval = /** @type {HTMLElement} */ (document.getElementById("file-input-policy"));
const policyStatus = /** @type {HTMLElement} */ (document.getElementById("policy-status"));

// Fliken Löneläget syns när underlaget och minst en referens är inlästa. Utan underlag är den låst som de andra
// flikarna; med underlag men utan referens är den dold (ADR-55).
export function _visaJamforelseFlik(synlig) {
    const tb = document.getElementById('tab-benchmark');
    if (!tb) return;
    tb.hidden = !synlig && state.data.length > 0;
    /** @type {HTMLInputElement} */ (tb).disabled = !synlig;
    const tip = tb.getAttribute('data-tip');
    if (synlig && tip) tb.setAttribute('title', tip);
    if (!synlig && tb.classList.contains('active')) /** @type {HTMLElement} */ (document.querySelector('.nav-item[data-tab="dashboard"]'))?.click();
}

export function synkaJamforelseFlik() { _visaJamforelseFlik(state.data.length > 0 && (state.policy.length > 0 || state.statistik.length > 0)); }

// ---- File Upload: External Statistics (Excel) ----
const statFilval = /** @type {HTMLElement} */ (document.getElementById("file-input-stat"));
const statStatus = /** @type {HTMLElement} */ (document.getElementById("stat-status"));

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartReferensfiler() {
    _kopplaNamnFalt('referens-namn', sattReferensNamn);
    document.getElementById('btn-referens-aterga')?.addEventListener('click', () => {
        aterstallReferens();
        synkaJamforelseFlik();
        const ps = document.getElementById('policy-status');
        if (ps) { ps.textContent = ''; ps.className = 'status-msg'; }
        aterstallFilruta('upload-cell-policy', 'upload-cell optional', 'Valfritt');
        ritaOmReferens();
    });
    policyFilval.addEventListener("change", e => {
        const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
        if (!file) return;
        /** @type {HTMLInputElement} */ (e.target).value = '';   // samma fil ska kunna väljas igen
        visaLaddning();
        // Gemensam läsväg: CSV (alla kodningar/avgränsare, preamble-tolerant) + XLSX.
        // `aid` är VALFRI: en policyrad får vara BAS-nivå, AID-specifik
        // (yrke oavsett BAS) eller AID+BAS (mest specifik). Uppslaget sker via
        // policyFor(), som följer specificitetsordningen. _hittaCsvRubrik poängsätter
        // synonymträffar (kräver inte alla grupper), så BAS-only-filer hittas också.
        lasTabellfil(file, [["bas"], ["aid", "yrkeskod", "befattningskod"], ["p10", "10e", "10"], ["median", "med"], ["p90", "90e", "90"]], res => {
            if (!res.ok) {
                doljLaddning();
                policyStatus.textContent = '' + res.error;
                policyStatus.className = "status-msg";
                return;
            }
            const nInlasta = _lasInReferens(res.rows, file.name);
            if (!nInlasta) {
                doljLaddning();
                policyStatus.textContent = 'Inga giltiga rader — varje rad behöver en BAS-kolumn, en AID-kolumn eller båda, och inga negativa värden.';
                policyStatus.className = "status-msg";
                return;
            }
            const nAid = state.policy.filter(p => p.aid).length;
            const nBas = state.policy.filter(p => p.bas && !p.aid).length;
            const ejLasta = res.rows.length - nInlasta;
            policyStatus.textContent = `${state.policy.length} ${state.policy.length === 1 ? 'rad inläst' : 'rader inlästa'}`
                + (nAid ? ` (${nBas} per ${T.niva.en}, ${nAid} per ${T.kod.en})` : ` (per ${T.niva.en})`)
                + (ejLasta ? ` · ${ejLasta} ${ejLasta === 1 ? 'rad' : 'rader'} utan BAS och AID eller med ett negativt värde lästes inte` : '')
                + _dubblettBesked(dubbletterAidBas(state.policy))
                + ` · ${res.encoding === 'XLSX' ? res.format : res.encoding}`;
            policyStatus.className = "status-msg success";
            synkaJamforelseFlik();
            markeraFilrutaInlast('upload-cell-policy', 'Inläst');
            state.filnamn.policy = file.name; ritaFilrutor();
            doljLaddning(); ritaKravstatus();
            ritaKonsistenskontroll();
            ritaAtgardslista();
            ritaKartlaggningensSteg();
            if (hamtaData().length > 0) ritaLoneoversikt();
        }, 'stallningstagande');
    });
    statFilval.addEventListener("change", e => {
        const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
        if (!file) return;
        /** @type {HTMLInputElement} */ (e.target).value = '';   // samma fil ska kunna väljas igen
        visaLaddning();
        // Gemensam läsväg (samma som struktur/policy/historik): CSV alla kodningar +
        // preamble-tolerans, XLSX, och tydligt .xls-besked. Rubrikraden hittas av lasTabellfil via synonymerna
        // AID + Median; kolumnrollerna mappas därefter på de funna rubrikerna.
        lasTabellfil(file, [["aid", "yrkesgrupp"], ["median"]], res => {
            if (!res.ok) {
                doljLaddning();
                statStatus.textContent = "Fel: " + res.error;
                statStatus.className = "status-msg error";
                return;
            }
            try {
                // Kolumnerna och raderna tolkas i src/lib/inlasning.js (tolkaStatistikfil). Statistikens AID och BAS
                // saneras som lönefilens: HTML-metatecken bort vid inläsning (esc() vid rendering är det egentliga skyddet).
                const t = tolkaStatistikfil(res.headers, res.rows);
                if (t.fel !== undefined) throw new Error(t.fel);
                // En fil utan giltiga rader ändrar ingenting: den inlästa statistiken står kvar.
                if (!t.rader.length) throw new Error(`Inga giltiga rader: varje rad behöver en ${T.kod.en} och en median över noll${t.ogiltiga ? ` (${t.ogiltiga} ${t.ogiltiga === 1 ? 'rad' : 'rader'} i filen)` : ''}.`);
                state.statistik = t.rader;
                state.statistikNamn = namnFranFil(file.name);
                state.statistikKalla = 'fil';
                // Likvärdighetsparen jämförs mot statistiken — ett sparat resultat gäller inte längre.
                if (state.likvardighet) state.likvardighet.result = null;
                state.statistikHasP10 = t.harP10;
                state.statistikHasP90 = t.harP90;
                state.statistikHasKon = t.harKon;
                const extras = [];
                if (state.statistikHasP10) extras.push('P10');
                if (state.statistikHasP90) extras.push('P90');
                if (state.statistikHasKon) extras.push('könsfördelning');
                const src = res.encoding === 'XLSX' ? res.format : res.encoding;
                statStatus.textContent = (extras.length
                    ? `${state.statistik.length} ${state.statistik.length === 1 ? 'post inläst' : 'poster inlästa'} (median + ${extras.join(' + ')})`
                    : `${state.statistik.length} ${state.statistik.length === 1 ? 'post inläst' : 'poster inlästa'}`)
                    + (t.ogiltiga ? ` · ${t.ogiltiga} ${t.ogiltiga === 1 ? 'rad' : 'rader'} utan ${T.kod.en} eller median över noll lästes inte` : '')
                    + _dubblettBesked(t.dubbletter) + ` · ${src}`;
                statStatus.className = "status-msg success";
                markeraFilrutaInlast('upload-cell-stat', 'Inläst');
                state.filnamn.statistik = file.name; ritaFilrutor();
                ritaPaketinfo(); uppdateraPaketKnapp();
                synkaJamforelseFlik();
                doljLaddning(); ritaKravstatus();
                ritaKonsistenskontroll();
                ritaAtgardslista();
                ritaKartlaggningensSteg();
            } catch (err) {
                doljLaddning();
                statStatus.textContent = "Fel: " + err.message;
                statStatus.className = "status-msg error";
            }
        }, 'jamforelsestatistik');
    });
}

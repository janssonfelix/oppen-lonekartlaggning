// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Tabellerna per AID-kod och BAS-intervall: lika arbete, likvärdigt arbete, hierarkisk jämförelse, individnivå ----
//
// Lika arbete är samma yrkesgrupp (AID-kod) på samma nivå (BAS-intervall). De fyra tabellerna här är de en skriven
// lönekartläggning behöver på den nivån, med kolumnnamn som går att klistra in i rapporten utan att ändras. Logiken
// ligger i src/lib/aidbas.js (speglad); här står reglerna som hör till verktyget:
//
//   - Lika arbete AID x BAS är Lika arbetes grupper och status (laLikaGrupper i 41-lika-arbete.js) i BAS-ordning,
//     med samma k-regel som tabellen per AID-etikett: en grupp där ett kön är under kTroskel() står utan könsuppdelade
//     mått, en grupp som helt ligger under den får ingen rad utan namnges i noten. Tabellen räknar ingen egen
//     bedömning, så att de två tabellerna inte kan säga olika om samma grupp (ADR-90). Gränserna är de statusen
//     prövades mot; trattdiagrammet visar samma gränser som bild.
//   - I de andra tre tabellerna kräver könsuppdelade mått och gruppens median och spridning statGolv() personer —
//     standard 10, följer med uppåt när minsta gruppstorlek höjs — i båda lägena, som övriga skattningar. En grupp där
//     något kön är mindre står i arbetslistan Analys på individnivå.
//   - I de tre tabellerna kräver en egen rad minst LITET_UNDERLAG (5) personer i exportläget; mindre grupper räknas upp
//     i en not under tabellen, med namn och antal men utan löner (ADR-12, ADR-57). På skärmen visas alla grupper (ADR-51).
//   - Kvinnodominerat vid *Mer än X %* (nyckeln 'do') eller *X % eller mer* (nyckeln 'scb'; ADR-72): valet i
//     Likvärdigt arbetes inställningar, standard *Mer än*; X är kvinnotröskeln där (standard 60 %). Samma definition gäller i hela
//     verktyget (ADR-60): kvDomNu() och konsklassNu() nedan, som anropar _arKvinnodominerad/_konsklass ur
//     src/lib/likvardighet.js.
//   - Jämförelseyrken är alla grupper som inte är kvinnodominerade, eller bara de mansdominerade med filtret
//     state.likvardighet.jamforelse = 'mansdominerade' (ADR-60) — samma mängd som kandidatparen.
//   - Lönemånaden står ovanför varje tabell; den anges i Inställningar, och tomt skrivs ut som "inte angiven".
import { hierarkiskaPar, individnivaTabell, ingaParText, klassNamn, kvDefinitionText, likaArbeteTabell, likvardigtTabell } from '../lib/aidbas.js';
import { arKvinnodominerad, konsklass } from '../lib/likvardighet.js';
import { personOrd } from '../lib/namn.js';
import { skrKvinnoandel } from '../lib/skrreferens.js';
import { direktivMarkering } from '../lib/status.js';
import { svKr, svPct, svTal } from '../lib/talformat.js';
import { adjektiv, artikel, stor } from '../lib/termer.js';
import { esc } from './01-html-och-tillganglighet.js';
import { aktiveraSortering, flerKolumner } from './05-tabeller-och-lankar.js';
import { K_SKARM, kTroskel, LITET_UNDERLAG, statGolv } from './06-k-troskel.js';
import { _skrDel, skrKallaKort } from './06-kvinnoandel-referens.js';
import { T, termText } from './09-termer.js';
import { _STS_DIR_ETIKETT, _STS_DIR_KOLUMN, _STS_DIR_TIPS, gapStatusNiva } from './10-diagramtema.js';
import { laggTillTabellverktyg, hamtaData, state } from './12-tillstand.js';
import { laLikaGrupper } from './41-lika-arbete.js';

/** Antalet per kön (och per grupp för median och spridning) som krävs för ett lönemått. */
function aidbasK() { return statGolv(); }
/** Antalet i gruppen som krävs för en egen rad: 5 i exportläget, alla på skärmen (ADR-51). */
function aidbasGolv() { return kTroskel() > K_SKARM ? LITET_UNDERLAG : 1; }
/** Vald definition av kvinnodominerat arbete: 'do' (*Mer än X %*) eller 'scb' (*X % eller mer*). Nycklarna är historiska och
 *  står kvar för sparade konfigurationsfiler (ADR-72). */
export function aidbasDefinition() { return state.likvardighet && state.likvardighet.kvDomDefinition === 'scb' ? 'scb' : 'do'; }
/** Gränsen i procent kvinnor: kvinnotröskeln i Likvärdigt arbete. */
export function aidbasGrans() { return (state.likvardighet && state.likvardighet.kvinnoTrosholdPct) || 60; }
/** Jämförelsemängden: 'alla' som inte är kvinnodominerade (standard) eller bara 'mansdominerade' (ADR-60). */
export function lvJamforelse() { return state.likvardighet && state.likvardighet.jamforelse === 'mansdominerade' ? 'mansdominerade' : 'alla'; }
/** Om en andel kvinnor (procent) är kvinnodominerad enligt verktygets valda definition — den enda i verktyget (ADR-60). */
export function kvDomNu(pct) { return arKvinnodominerad(pct, aidbasDefinition(), aidbasGrans()); }
/** Klassen för en andel kvinnor: 'kvinnodominerad', 'mansdominerad', 'blandad' eller '' (ADR-60). */
export function konsklassNu(pct) { return konsklass(pct, aidbasDefinition(), aidbasGrans()); }
/** Gränsen för kvinnodominerat i ord, med valets lydelse (ADR-72): "mer än 60 % kvinnor" ('do') eller
 *  "60 % kvinnor eller mer" ('scb'). Samma text som tabellerna och metodbladen (kvDefinitionText i src/lib/aidbas.js). */
export function kvDomGransText() { return kvDefinitionText(aidbasDefinition(), svTal(aidbasGrans(), 0)); }
/** Jämförelsemängden i ord, med gränsen: "inte kvinnodominerade, ≤ 60 %" eller "mansdominerade, < 40 %". */
export function jamforelseGransText() {
    const g = aidbasGrans(), scb = aidbasDefinition() === 'scb';
    return lvJamforelse() === 'mansdominerade'
        ? `mansdominerade, ${scb ? '≤' : '<'} ${svTal(100 - g, 0)} % kvinnor`
        : `inte kvinnodominerade, ${scb ? '<' : '≤'} ${svTal(g, 0)} % kvinnor`;
}
/** Klassordet för ett jämförelseyrke i tabellerna. */
export function konsklassOrd(klass) { return klass === 'mansdominerad' ? 'mansdominerad' : klass === 'blandad' ? 'blandad' : klass === 'kvinnodominerad' ? 'kvinnodominerad' : '–'; }
/** Meningen om vilka grupper som jämförs med de kvinnodominerade (ADR-60). */
function jamforelseMening() {
    return lvJamforelse() === 'mansdominerade'
        ? 'Som jämförelse används bara de mansdominerade grupperna (valt i Likvärdigt arbetes inställningar).'
        : 'Som jämförelse används alla grupper som inte är kvinnodominerade, både mansdominerade och könsblandade.';
}
/** Texten om definitionen, för tabellerna och metodbladet. */
export function aidbasDefinitionText() { return kvDefinitionText(aidbasDefinition(), aidbasGrans()); }
/** Raden om lönemånaden ovanför tabellerna. */
function lonemanadText() { return `Lönemånad: ${state.lonemanad ? state.lonemanad : 'inte angiven'}`; }
/** Sätter lönemånaden (från panelen eller konfigurationsfilen) och synkar fältet. */
export function sattLonemanad(v) {
    state.lonemanad = String(v ?? '').trim().slice(0, 40);
    const el = /** @type {HTMLInputElement|null} */ (document.getElementById('lonemanad'));
    if (el && el.value !== state.lonemanad) el.value = state.lonemanad;
}

/** Andelen kvinnor nationellt för en AID-kod (SKR:s personalstatistik, organisationstypen i Inställningar), eller null. */
function _aidbasNationell(aid) {
    const r = typeof skrKvinnoandel === 'function' ? skrKvinnoandel(aid, { del: _skrDel() }) : null;
    return r && typeof r.pct === 'number' ? r.pct : null;
}
/** De fyra tabellerna ur underlaget, med verktygets regler. */
function aidbasTabeller(d = hamtaData()) {
    const k = aidbasK(), golv = aidbasGolv(), definition = aidbasDefinition(), grans = aidbasGrans(), jamforelse = lvJamforelse();
    return {
        k, golv, definition, grans, jamforelse,
        lika: likaArbeteTabell(laLikaGrupper(d)),
        likvardigt: likvardigtTabell(d, { k, golv, definition, grans, jamforelse, nationell: _aidbasNationell }),
        par: hierarkiskaPar(d, { k, definition, grans, jamforelse }),
        individ: individnivaTabell(d, { k, golv })
    };
}

// ---- Kolumnerna: exakt de namn rapporten använder. typ styr talformatet på skärmen och i Excel. ----
// Kolumnerna för intervallet, koden och etikettnamnet heter efter termerna (ADR-74); kolumnen med r.yrke visar
// etikettnamnet, eftersom koden står i kolumnen före. Ett fjärde värde är rubrikens data-kol, för kolumnerna som
// grundvyn gömmer bakom Fler kolumner (AIDBAS_LIKA_DOLDA_KOLUMNER, AIDBAS_LV_DOLDA_KOLUMNER); exporterna har alla.
const _AIDBAS_NIVA = stor(T.niva.en), _AIDBAS_KOD = stor(T.kod.en), _AIDBAS_NAMN = stor(T.namn.en);
/** @type {{[tabell: string]: Array<[string, string, (r: any) => any, string?]>}} */
const AIDBAS_KOL = {
    lika: [[_AIDBAS_NIVA, 'text', r => r.bas], [_AIDBAS_KOD, 'text', r => r.aid], [_AIDBAS_NAMN, 'text', r => r.yrke], ['Antal kvinnor', 'antal', r => r.nKv], ['Antal män', 'antal', r => r.nMa],
           ['Medianlön kvinnor', 'kr', r => r.medKv], ['Medianlön män', 'kr', r => r.medMa], ['Kvinnors median i % av mäns', 'pct', r => r.kvot],
           ['Nedre gräns', 'pct', r => r.lag, 'nedre'], ['Övre gräns', 'pct', r => r.hog, 'ovre'], ['Status', 'text', r => _aidbasStatus(r)],
           // Direktivmarkeringen på den ojusterade löneskillnaden (ADR-59): ingen bedömning, bara var 5 % nås.
           [_STS_DIR_KOLUMN, 'text', r => (r.kvot != null && direktivMarkering(r.kvot) ? _STS_DIR_ETIKETT : ''), 'direktiv']],
    likvardigt: [[_AIDBAS_NIVA, 'text', r => r.bas], [_AIDBAS_KOD, 'text', r => r.aid], [_AIDBAS_NAMN, 'text', r => r.yrke], ['Antal', 'antal', r => r.n],
                 ['Andel kvinnor (%)', 'pct', r => r.andelKv], ['Andel kvinnor nationellt (%)', 'pct', r => r.andelKvNat, 'nationellt'], ['Klassning', 'text', r => r.klass],
                 ['Brukar anses kvinnodominerad', 'text', r => r.brukar, 'brukar'], ['Medianlön', 'kr', r => r.median], ['Lönespridning', 'kvot', r => r.spridning, 'spridning']],
    sammanfattning: [[_AIDBAS_NIVA, 'text', s => s.bas], ['Kvinnodominerade grupper', 'antal', s => s.antalKvDom], ['Högsta medianlön kvinnodominerad', 'kr', s => s.kvDom.hogst], ['Lägsta medianlön kvinnodominerad', 'kr', s => s.kvDom.lagst],
                     ['Övriga grupper', 'antal', s => s.antalOvriga], ['Högsta medianlön övriga', 'kr', s => s.ovriga.hogst], ['Lägsta medianlön övriga', 'kr', s => s.ovriga.lagst],
                     ['Skillnad (kr)', 'kr', s => s.skillnadKr], ['Skillnad (%)', 'pct', s => s.skillnadPct]],
    par: [['Grupp A (ej kvinnodominerad)', 'text', p => `${p.a.aid} ${p.a.yrke}`], ['BAS A', 'text', p => p.a.bas], ['Median A', 'kr', p => p.a.median],
          ['Grupp B (kvinnodominerad)', 'text', p => `${p.b.aid} ${p.b.yrke}`], ['BAS B', 'text', p => p.b.bas], ['Median B', 'kr', p => p.b.median],
          ['Skillnad (kr)', 'kr', p => p.skillnadKr], ['Skillnad (%)', 'pct', p => p.skillnadPct]],
    individ: [[_AIDBAS_NIVA, 'text', r => r.bas], [_AIDBAS_KOD, 'text', r => r.aid], [_AIDBAS_NAMN, 'text', r => r.yrke], ['Antal kvinnor', 'antal', r => r.nKv], ['Antal män', 'antal', r => r.nMa],
              ['Analys genomförd', 'text', () => ''], ['Resultat', 'text', () => '']]
};
// Kolumnerna som grundvyn gömmer bakom Fler kolumner (F12, F14 i etapp 1b): gränserna och direktivmarkeringen i Lika
// arbete, de nationella kolumnerna och spridningen i Likvärdigt arbete. Statusen och klassningen står kvar.
const AIDBAS_LIKA_DOLDA_KOLUMNER = ['nedre', 'ovre', 'direktiv'];
const AIDBAS_LV_DOLDA_KOLUMNER = ['nationellt', 'brukar', 'spridning'];
/** Noten om grupperna under golvet: namn och antal, inga löner. '' när alla grupper har en rad. */
function _aidbasSmaNot(sma, golv) {
    if (!sma.length) return '';
    return `Grupper med färre än ${golv} ${personOrd(golv)} redovisas inte som egen rad (${sma.length}): ${sma.map(s => `${s.aid} ${s.yrke} · BAS ${s.bas} (${s.nKv} kvinnor, ${s.nMa} män)`).join('; ')}.`;
}
/** Statusen för en rad i Lika arbete AID x BAS, med orden i tabellen per AID-etikett (ADR-90). */
function _aidbasStatus(r) {
    return r.samladMedian ? `Könsuppdelningen är för liten (ett kön n < ${kTroskel()})` : gapStatusNiva(r.niva).serie;
}
/** Texten om Lika arbete AID x BAS ovanför tabellen och i bladet: grupperna, k-regeln, statusen och gränserna. */
function _aidbasLikaText() {
    const k = kTroskel(), g = statGolv();
    return `Samma grupper och samma status som Lika arbetes tabell per ${T.enhet.en}, ordnade efter ${T.niva.en}. `
        + (k > K_SKARM ? `Ett köns median och kvoten står när varje kön har minst ${k} ${personOrd(k)}; annars "Könsuppdelningen är för liten". ` : '')
        + `Statusen prövas när varje kön har minst ${g} ${personOrd(g)}, annars "Går ej att bedöma": Värt att granska = utanför slumpens gränser och minst 3 % (verktygets storleksgräns), Följ upp = det ena men inte det andra, Balanserat = inget av dem. `
        + `Gränserna är de 95-procentiga för slumpen som statusen prövades mot (omkastning av könen inom gruppen, samma gränser som trattdiagrammet).`;
}
/** Noten under Lika arbete AID x BAS: grupperna under tröskeln med namn, och antalet grupper som inte går att jämföra. */
function _aidbasLikaNot(lika) {
    const k = kTroskel(), n = lika.utelamnade.length, m = lika.ejJamforbara;
    return [n ? `${n} ${n === 1 ? 'grupp visas' : 'grupper visas'} inte: ${lika.utelamnade.join(', ')}. ${n === 1 ? 'Den har' : 'De har'} färre än ${k} ${personOrd(k)}, och ${n === 1 ? 'dess' : 'deras'} lönemått skulle kunna peka ut enskilda.` : '',
            m ? `${m} ${m === 1 ? 'grupp har' : 'grupper har'} färre än två kvinnor eller två män och jämförs inte.` : ''].filter(Boolean).join(' ');
}
/** "Inget BAS-intervall", böjt efter intervallets genus. */
function _aidbasIngetIntervall() { return `${adjektiv({ utrum: 'Ingen', neutrum: 'Inget', plural: 'Inga' }, T.niva)} ${T.niva.en}`; }
/** Sammanfattningen per BAS-intervall som en mening per intervall, för skärmen. */
function _aidbasSammanfattningText(s) {
    return `BAS ${s.bas}: kvinnodominerade grupper (${s.antalKvDom}) har medianlön ${svTal(s.kvDom.lagst, 0)}–${svTal(s.kvDom.hogst, 0)} kr, övriga (${s.antalOvriga}) ${svTal(s.ovriga.lagst, 0)}–${svTal(s.ovriga.hogst, 0)} kr; `
        + `högsta median övriga mot högsta kvinnodominerad: ${s.skillnadKr >= 0 ? '+' : '−'}${svTal(Math.abs(s.skillnadKr), 0)} kr (${s.skillnadPct == null ? '–' : (s.skillnadPct >= 0 ? '+' : '−') + svPct(Math.abs(s.skillnadPct), 1)}).`;
}

// ---- Skärmen ----
function _aidbasCell(v, typ) {
    if (v == null || v === '') return '<td class="tal">–</td>';
    if (typ === 'text') return `<td>${esc(String(v))}</td>`;
    const text = typ === 'kr' ? svKr(v) : typ === 'pct' ? svPct(v, 1) : typ === 'kvot' ? svTal(v, 2) : svTal(v, 0);
    // Sorteringsvärdet avrundas: ett tal med många decimaler kan av en slump innehålla en lön som siffersekvens.
    return `<td class="tal" data-sort-value="${typeof v === 'number' ? Math.round(v * 100) / 100 : ''}">${text}</td>`;
}
/**
 * En tabell på skärmen: lönemånad, kolumnerna, raderna och noten; sortering och Kopiera/CSV som övriga tabeller.
 * @param {string} id
 * @param {Array<[string, string, (r: any) => any, string?]>} kolumner
 * @param {any[]} rader
 * @param {{not?: string, tom?: string, fil?: string}} [val]
 */
function _aidbasTabellHtml(id, kolumner, rader, { not = '', tom = 'Inga grupper att visa.', fil = id } = {}) {
    const kropp = rader.length ? rader.map(r => `<tr>${kolumner.map(([, typ, f]) => _aidbasCell(f(r), typ)).join('')}</tr>`).join('') : '';
    return `<p class="text-dampad-sm marg-0-0-6"><strong>${esc(lonemanadText())}</strong></p>`
        + (rader.length ? `<div class="table-container"><table id="${id}" class="data-table" data-aidbas-fil="${esc(fil)}"><thead><tr>${kolumner.map(([namn, typ, , kol]) => `<th${kol ? ` data-kol="${kol}"` : ''}${typ === 'text' ? '' : ' class="tal"'}${namn === _STS_DIR_KOLUMN ? ` title="${esc(_STS_DIR_TIPS)}"` : ''}>${esc(namn)}</th>`).join('')}</tr></thead><tbody>${kropp}</tbody></table></div>`
                        : `<p class="text-dampad-sm">${esc(tom)}</p>`)
        + (not ? `<p class="text-dampad-xs marg-8-0-0">${esc(not)}</p>` : '');
}
/**
 * Sortering, Kopiera/CSV och, för en tabell med kolumner bakom växeln, Fler kolumner.
 * @param {string} id
 * @param {string[]} [dolda]  data-kol för kolumnerna som grundvyn gömmer
 * @param {string} [nyckel]   nyckeln i state.flerKolumner
 */
function _aidbasEfter(id, dolda, nyckel) {
    if (!document.getElementById(id)) return;
    if (typeof aktiveraSortering === 'function') aktiveraSortering(id);
    if (typeof laggTillTabellverktyg === 'function') laggTillTabellverktyg(id, document.getElementById(id)?.getAttribute('data-aidbas-fil') || id);
    if (dolda && nyckel && typeof flerKolumner === 'function') flerKolumner(id, dolda, nyckel);
}
function _aidbasNyckel(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

/** Lika arbete: tabell 1 och arbetslistan (tabell 4). */
export function renderAidBasLika() {
    const lika = document.getElementById('aidbas-lika'), individ = document.getElementById('aidbas-individ');
    if (!lika || !individ) return;
    const d = hamtaData();
    if (!d.length) { lika.innerHTML = ''; individ.innerHTML = ''; _aidbasNyckel('nyckel-la-aidbas', ''); _aidbasNyckel('nyckel-la-individ', ''); return; }
    const t = aidbasTabeller(d);
    lika.innerHTML = _aidbasTabellHtml('aidbas-lika-tabell', AIDBAS_KOL.lika, t.lika.rader, { not: _aidbasLikaNot(t.lika), fil: 'lika_arbete_aid_bas' })
        + `<p class="text-dampad-xs marg-8-0-0">${esc(_aidbasLikaText())} Kolumnen ${esc(_STS_DIR_KOLUMN)}: ${esc(_STS_DIR_TIPS)}</p>`;
    _aidbasEfter('aidbas-lika-tabell', AIDBAS_LIKA_DOLDA_KOLUMNER, 'aidbasLika');
    // Samma nyckeltal som tabellen per AID-etikett: grupperna Värt att granska och Följ upp.
    const jamforda = t.lika.rader.filter(r => !r.samladMedian);
    const granska = jamforda.filter(r => r.niva === 'granska').length, folj = jamforda.filter(r => r.niva === 'folj').length;
    _aidbasNyckel('nyckel-la-aidbas', jamforda.length ? `${granska} att granska${folj ? ` · ${folj} att följa upp` : ''}` : '');
    individ.innerHTML = _aidbasTabellHtml('aidbas-individ-tabell', AIDBAS_KOL.individ, t.individ.rader, { not: _aidbasSmaNot(t.individ.sma, t.golv), tom: `Alla grupper har minst ${t.k} kvinnor och ${t.k} män.`, fil: 'analys_pa_individniva' });
    _aidbasEfter('aidbas-individ-tabell');
    _aidbasNyckel('nyckel-la-individ', t.individ.rader.length ? `${t.individ.rader.length} grupper` : '');
}
/** Likvärdigt arbete: tabell 2 med sammanfattningen, och den hierarkiska jämförelsen (tabell 3). */
export function renderAidBasLikvardigt() {
    const lv = document.getElementById('aidbas-likvardigt'), hi = document.getElementById('aidbas-hierarki');
    if (!lv || !hi) return;
    const d = hamtaData();
    if (!d.length) { lv.innerHTML = ''; hi.innerHTML = ''; _aidbasNyckel('nyckel-lv-aidbas', ''); _aidbasNyckel('nyckel-lv-hierarki', ''); return; }
    const t = aidbasTabeller(d);
    const def = `Kvinnodominerad vid ${aidbasDefinitionText()}; mansdominerad med samma gräns för män; övriga könsblandade. ${jamforelseMening()} "Brukar anses kvinnodominerad" bygger på andelen kvinnor nationellt (${skrKallaKort()}) med samma definition.`;
    lv.innerHTML = _aidbasTabellHtml('aidbas-likvardigt-tabell', AIDBAS_KOL.likvardigt, t.likvardigt.rader, { not: _aidbasSmaNot(t.likvardigt.sma, t.golv), fil: 'likvardigt_arbete' })
        + `<p class="text-dampad-xs marg-8-0-0">${esc(def)} Medianlön och lönespridning ((P90 − P10) / median) bara för grupper med minst ${t.k} ${personOrd(t.k)}.</p>`
        + (t.likvardigt.sammanfattning.length ? `<h3 class="fs-md marg-14-0-4">${esc(termText('Sammanfattning per {niva.en}'))}</h3><ul class="text-dampad-sm">${t.likvardigt.sammanfattning.map(s => `<li>${esc(_aidbasSammanfattningText(s))}</li>`).join('')}</ul>`
                                               : `<p class="text-dampad-xs marg-8-0-0">${_aidbasIngetIntervall()} har både kvinnodominerade grupper och andra grupper med minst ${t.k} ${personOrd(t.k)}, så det finns ingen sammanfattning.</p>`);
    _aidbasEfter('aidbas-likvardigt-tabell', AIDBAS_LV_DOLDA_KOLUMNER, 'aidbasLikvardigt');
    const kvDom = t.likvardigt.rader.filter(r => r.klass === klassNamn().kv).length;
    _aidbasNyckel('nyckel-lv-aidbas', t.likvardigt.rader.length ? `${t.likvardigt.rader.length} grupper · ${kvDom} kvinnodominerade (${kvDefinitionText(t.definition, t.grans)})` : '');
    hi.innerHTML = _aidbasTabellHtml('aidbas-hierarki-tabell', AIDBAS_KOL.par, t.par, { tom: ingaParText(), fil: 'hierarkisk_jamforelse' })
        + `<p class="text-dampad-xs marg-8-0-0">Kvinnodominerad vid ${esc(aidbasDefinitionText())}. Båda grupperna har minst ${t.k} ${personOrd(t.k)}. BAS-ordningen är bokstavsordningen.</p>`;
    _aidbasEfter('aidbas-hierarki-tabell');
    _aidbasNyckel('nyckel-lv-hierarki', t.par.length ? `${t.par.length} par` : 'inga par');
}

// ---- Excel: fyra blad, ett per tabell. Tal som tal med svenskt talformat i cellen; procent med en decimal. ----
const AIDBAS_TALFORMAT = { antal: '#,##0', kr: '#,##0', pct: '#,##0.0', kvot: '0.00' };
function _aidbasVarde(v, typ) {
    if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return '';
    if (typ === 'text') return String(v);
    return typ === 'pct' ? Math.round(v * 10) / 10 : typ === 'kvot' ? Math.round(v * 100) / 100 : Math.round(v);
}
/**
 * Ett blad: rubrik, lönemånad, eventuella inledande rader, kolumnerna, raderna (eller en tom-text) och noter.
 * @param {string} rubrik
 * @param {Array<[string, string, (r: any) => any, string?]>} kolumner
 * @param {any[]} rader
 * @param {{fore?: string[], efter?: string[], tom?: string}} [val]
 */
function _aidbasBlad(rubrik, kolumner, rader, { fore = [], efter = [], tom = '' } = {}) {
    /** @type {any[][]} */
    const rows = [[rubrik], [lonemanadText()], ...fore.map(t => [t]), []];
    const forstaRad = rows.length + 1;   // 1-baserat radnummer för första dataraden
    rows.push(kolumner.map(([namn]) => namn));
    if (rader.length) rader.forEach(r => rows.push(kolumner.map(([, typ, f]) => _aidbasVarde(f(r), typ))));
    else if (tom) rows.push([tom]);
    for (const t of efter) if (t) rows.push([], [t]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    if (rader.length) {
        kolumner.forEach(([, typ], c) => {
            const z = AIDBAS_TALFORMAT[typ];
            if (!z) return;
            for (let r = 0; r < rader.length; r++) { const cell = ws[XLSX.utils.encode_cell({ c, r: forstaRad + r })]; if (cell && typeof cell.v === 'number') cell.z = z; }
        });
    }
    ws['!cols'] = kolumner.map(([namn, typ]) => ({ wch: typ === 'text' ? Math.max(14, Math.min(44, namn.length + 4)) : Math.max(10, namn.length + 2) }));
    return ws;
}
/** Bladens namn i ordning, som förhandsbeskedet och arbetsboken delar. */
export const AIDBAS_BLADNAMN = ['Lika arbete AID x BAS', 'Likvärdigt arbete', 'Hierarkisk jämförelse', 'Analys på individnivå'];
/**
 * Bladet Lika arbete AID x BAS, som Excel (alla flikar) och protokollet för gemensam lönebedömning delar.
 * @param {any} lika tabellen ur `_aidbasLika` (`aidbasTabeller(d).lika`)
 */
export function _aidbasLikaBlad(lika) {
    return _aidbasBlad(termText('Lika arbete: kvinnors medianlön i procent av mäns per {kod.en} och {niva.en}'), AIDBAS_KOL.lika, lika.rader,
        { fore: [_aidbasLikaText(), `${_STS_DIR_KOLUMN}: ${_STS_DIR_TIPS}`],
          efter: [_aidbasLikaNot(lika)], tom: 'Inga grupper att visa.' });
}
/** @returns {[string, any][]} bladets namn och kalkylblad */
export function _aidbasExcelBlad() {
    const d = hamtaData();
    if (!d.length) return [];
    const t = aidbasTabeller(d);
    const def = `Kvinnodominerad vid ${aidbasDefinitionText()}; mansdominerad med samma gräns för män; övriga könsblandade. ${jamforelseMening()}`;
    const lika = _aidbasLikaBlad(t.lika);
    const lv = _aidbasBlad(termText('Likvärdigt arbete: grupperna per {niva.en}'), AIDBAS_KOL.likvardigt, t.likvardigt.rader,
        { fore: [def, `"Brukar anses kvinnodominerad" bygger på andelen kvinnor nationellt (${skrKallaKort()}) med samma definition. Medianlön och lönespridning ((P90 − P10) / median) bara för grupper med minst ${t.k} ${personOrd(t.k)}.`],
          efter: [_aidbasSmaNot(t.likvardigt.sma, t.golv)], tom: 'Inga grupper att visa.' });
    // Sammanfattningen per BAS-intervall under tabellen i samma blad.
    const s = t.likvardigt.sammanfattning;
    const rad0 = XLSX.utils.decode_range(lv['!ref']).e.r + 3;
    XLSX.utils.sheet_add_aoa(lv, [[termText('Sammanfattning per {niva.en}: högsta och lägsta medianlön bland kvinnodominerade grupper och bland övriga; skillnaden är högsta median övriga mot högsta kvinnodominerad.')],
        ...(s.length ? [AIDBAS_KOL.sammanfattning.map(([namn]) => namn), ...s.map(x => AIDBAS_KOL.sammanfattning.map(([, typ, f]) => _aidbasVarde(f(x), typ)))]
                     : [[`${_aidbasIngetIntervall()} har både kvinnodominerade grupper och andra grupper med minst ${t.k} ${personOrd(t.k)}.`]])], { origin: rad0 });
    if (s.length) AIDBAS_KOL.sammanfattning.forEach(([, typ], c) => { const z = AIDBAS_TALFORMAT[typ]; if (!z) return;
        for (let r = 0; r < s.length; r++) { const cell = lv[XLSX.utils.encode_cell({ c, r: rad0 + 2 + r })]; if (cell && typeof cell.v === 'number') cell.z = z; } });
    const par = _aidbasBlad('Hierarkisk jämförelse: arbete med lägre krav, som inte är kvinnodominerat, med högre lön än kvinnodominerat arbete med högre krav', AIDBAS_KOL.par, t.par,
        { fore: [`${def} Båda grupperna har minst ${t.k} ${personOrd(t.k)}. BAS-ordningen är bokstavsordningen.`], tom: ingaParText() });
    const individ = _aidbasBlad('Analys på individnivå: grupper där något kön har färre än ' + t.k + ' ' + personOrd(t.k), AIDBAS_KOL.individ, t.individ.rader,
        { fore: ['Arbetslista utan löner. Fyll i kolumnerna Analys genomförd och Resultat.'], efter: [_aidbasSmaNot(t.individ.sma, t.golv)], tom: `Alla grupper har minst ${t.k} kvinnor och ${t.k} män.` });
    return [[AIDBAS_BLADNAMN[0], lika], [AIDBAS_BLADNAMN[1], lv], [AIDBAS_BLADNAMN[2], par], [AIDBAS_BLADNAMN[3], individ]];
}
/** Raderna om tabellerna för bladen Metodik och Metod & parametrar: [rubrik, text]. */
export function _aidbasMetodRader() {
    const k = aidbasK(), golv = kTroskel() > K_SKARM ? LITET_UNDERLAG : 1;
    return [
        [termText('Tabellerna per {kod.en} och {niva.en}'), `Bladen ${AIDBAS_BLADNAMN.join(', ')} grupperar varje person på ${T.kod.en} och ${T.niva.en} ur personens egen rad: utgångspunkten för lika arbete är samma ${T.enhet.en} på samma nivå, och ${artikel(T.enhet)} ${T.enhet.en} i flera intervall får en rad per intervall. ${lonemanadText()}.`],
        ['Små grupper i tabellerna per AID och BAS', `${AIDBAS_BLADNAMN[0]} har Lika arbetes grupper och regler: ett köns median och kvoten redovisas när varje kön har minst ${kTroskel()} ${personOrd(kTroskel())}, och en grupp med färre än så av ett kön och totalt får ingen rad utan namnges i en not. I de andra bladen får grupper med färre än ${golv} ${personOrd(golv)} ingen egen rad utan räknas upp i en not under tabellen med namn och antal; gruppens median och lönespridning redovisas bara när gruppen har minst ${k} ${personOrd(k)}. Arbetslistan Analys på individnivå tar upp grupperna där något kön är mindre än ${k}, utan löner.`],
        ['Gränser för slumpen (statusen i Lika arbete, Slumpens gränser)', `Kvinnors median i procent av mäns jämförs med de mittersta 95 procenten av de kvoter slumpen ger när könen kastas om slumpvis mellan gruppens löner 1 000 gånger (för grupper över 300 personer en normalapproximation med gruppens egen spridning). Gränserna gäller gruppens egna löner, antal och könsfördelning. Statusen i Lika arbete, i tabellen per ${T.enhet.en} och i ${AIDBAS_BLADNAMN[0]}, väger samman gränserna med storleken 3 %; trattdiagrammet och bladet Slumpens gränser visar samma gränser utan status. En kvot utanför gränserna är svår att förklara med slumpen; gränserna är ett stöd för bedömningen, inte ett test som friar eller fäller.`],
        ['Kvinnodominerat arbete (Likvärdigt arbete, Hierarkisk jämförelse)', `Kvinnodominerad vid ${aidbasDefinitionText()}. Mansdominerad med samma gräns för män; övriga könsblandade. ${jamforelseMening()} Samma definition och samma jämförelsemängd gäller kandidatparen i Likvärdigt arbete och hela verktyget. "Brukar anses kvinnodominerad" bygger på andelen kvinnor nationellt med ${T.enhet.bf} (${skrKallaKort()}) med samma definition — lagen gäller arbete som är eller brukar anses vara kvinnodominerat. Lönespridning = (P90 − P10) / median. Den hierarkiska jämförelsen listar par där en grupp som inte är kvinnodominerad har lägre ${T.niva.en} och högre median än en kvinnodominerad grupp; BAS-ordningen är bokstavsordningen.`]
    ];
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartAidBasTabeller() {
    document.getElementById('lonemanad')?.addEventListener('change', e => {
        sattLonemanad(/** @type {HTMLInputElement} */ (e.target).value);
        // Den öppna fliken ritas om direkt; övriga ritas när de öppnas.
        const aktiv = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
        if (aktiv === 'matrix') renderAidBasLika();
        if (aktiv === 'likvardighet') renderAidBasLikvardigt();
    });
}

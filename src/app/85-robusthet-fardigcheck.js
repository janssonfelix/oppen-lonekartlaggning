// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 85-robusthet-fardigcheck.js — robusthetspanel och färdigcheck
//
// ROBUSTHETSPANEL: handläggaren gör val som tyst styr resultatet
// (kvinnotröskel, minGap, prioriteringsreferens). Panelen kör
// om kärnslutsatserna över ett litet rutnät av rimliga inställningar och visar
// vilka grupper som är STABILA och vilka som FLIPPAR. I facklig samverkan är
// "varför just de här grupperna?" alltid första frågan.
//
// FÄRDIGCHECK: korsläser "vad flaggades" mot "vad hanterades" — lösa trådar
// innan underlaget lämnas vidare. Observationer, inte fel; inget blockeras.
//
// Robusthetskörningarna ändrar inte state: kvinnotröskeln och referensen skickas som argument.
// ====================================================================
import { sifferprefixAvYrke } from '../lib/aid.js';
import { svPct } from '../lib/talformat.js';
import { ordForAntal, stor, termFras } from '../lib/termer.js';
import { esc } from './01-html-och-tillganglighet.js';
import { rapporteraFel } from './03-hjalpfunktioner.js';
import { ikon } from './03-ikoner.js';
import { smaGrupperVid } from '../lib/ktroskel.js';
import { _parForRedovisning, _parOverTroskel, _parUtelamnadeNot, kInstalld } from './06-k-troskel.js';
import { T } from './09-termer.js';
import { hamtaBasIntervall, hamtaData, policyFor, state } from './12-tillstand.js';
import { bedomningUnderlag, statusMarke, UK_ETIKETT } from './13-oversikt.js';
import { medExportLage, visningNy } from './23-exportgrind.js';
import { likvardighetResultat, likvardighetspar } from './34-likvardigt-arbete.js';
import { _laNyckel, _laSlutsats } from './41-lika-arbete.js';
import { _prioGrans, _valdPrioReferens, raknaPrioritering } from './55-prioritering.js';
import { _bes8Omraden } from './61-regler-och-praxis.js';

// ---- Rang 3: Robusthetspanel ------------------------------------------------

/**
 * Kör om § 3:10-kandidatlistan för flera kvinnotrösklar och mäter hur stabil
 * varje kandidatgrupp är. Ändrar inte state: tröskeln skickas som argument till likvardighetspar.
 *
 * Panelen ligger utanför fliken Likvärdigt arbete och följer därför tröskeln som allt annat
 * (`_parForRedovisning`, ADR-38): ett par där någon grupp är under tröskeln namnges inte, och
 * `utelamnade` är antalet sådana par (olika par, räknade en gång över körningarna); `not` är meningen om dem.
 * @returns {null|{trösklar:number[], rows:Array<{key:string, label:string, hits:number, of:number}>, utelamnade:number, not:string}}
 */
function robusthetLikvardighet(trösklar = [55, 60, 65]) {
    if (typeof likvardighetspar !== 'function') return null;
    const original = (state.likvardighet || {}).kvinnoTrosholdPct;
    const seen = new Map();
    const utelamnadePar = new Set();
    trösklar.forEach(t => {
        // Vid den inställda kvinnotröskeln är paren flikens (samma val); de andra trösklarna räknas för sig och sparas inte.
        let alla = [];
        try { alla = ((t === original ? likvardighetResultat() : likvardighetspar({ kvinnoTrosholdPct: t })) || {}).pairs || []; } catch (_e) { alla = []; }
        const { par: pairs } = _parForRedovisning(alla);
        alla.forEach(p => { if (!_parOverTroskel(p)) utelamnadePar.add(`${p.kvAid}|${p.kvBas}|${p.maAid}|${p.maBas}`); });
        const inThisRun = new Set();
        pairs.forEach(p => {
            const key = `${p.kvAid}|${p.kvBas}`;
            if (inThisRun.has(key)) return;
            inThisRun.add(key);
            if (!seen.has(key)) {
                seen.set(key, {
                    key,
                    label: `${p.kvAid}${p.kvLabel && p.kvLabel !== p.kvAid ? ' ' + p.kvLabel : ''} (BAS ${p.kvBas})`,
                    hits: 0
                });
            }
            seen.get(key).hits++;
        });
    });
    const rows = [...seen.values()]
        .map(r => ({ ...r, of: trösklar.length }))
        .sort((a, b) => b.hits - a.hits || a.label.localeCompare(b.label, 'sv'));
    const utelamnade = utelamnadePar.size;
    return { trösklar, rows, utelamnade, not: _parUtelamnadeNot(utelamnade) };
}

/**
 * Jämför prioriteringens topplista mellan de referenser som finns tillgängliga
 * (lönepolitiskt ställningstagande mot extern statistik). Muterar inte state —
 * raknaPrioritering tar referensen som argument.
 * @returns {null|{refs:string[], rows:Array<{key:string,label:string,hits:number,of:number,ranks:Object}>, tooFew:boolean}}
 */
function robusthetPrioritering(topN = 10) {
    if (typeof raknaPrioritering !== 'function') return null;
    const refs = [];
    if ((state.policy || []).length) refs.push('stallningstagande');
    if ((state.statistik || []).length) refs.push('statistik');
    if (refs.length < 2) return { refs, rows: [], tooFew: true };

    const seen = new Map();
    refs.forEach(ref => {
        let items = [];
        try { items = (raknaPrioritering(ref) || []).slice(0, topN); } catch (_e) { items = []; }
        items.forEach((it, idx) => {
            const key = `${it.aid}|${it.bas}`;
            if (!seen.has(key)) {
                seen.set(key, { key, label: `${it.yrke} (BAS ${it.bas})`, hits: 0, ranks: {} });
            }
            const rec = seen.get(key);
            rec.hits++;
            rec.ranks[ref] = idx + 1;
        });
    });
    const rows = [...seen.values()]
        .map(r => ({ ...r, of: refs.length }))
        .sort((a, b) => b.hits - a.hits || a.label.localeCompare(b.label, 'sv'));
    return { refs, rows, tooFew: false };
}

// Robusthetsanalysen kör om de TYNGSTA beräkningarna flera gånger
// (likvärdighetsparen 3x, prioriteringen 2x). På ett stort
// uttag tar det flera sekunder och blockerar gränssnittet, så den startas
// manuellt i stället för vid varje flikbyte.
/**
 * Översta raden i Exportera: läget i färdigchecken och robustheten. Varje del lämnar sitt läge här när den ritas, och
 * raden ritas om. Rapportunderlaget står i fliken Rapporttext och lämnar bara antalet avsnitt i sitt nyckeltal.
 * Färdigcheckens punkter är observationer och robusthetens gränsfall är förbehåll — inget av dem märks som fel.
 */
/** @type {{fardig: any[]|null, robust: any, block: any}} */
const _dkLage = { fardig: null, robust: null, block: null };
export function _dkRitaTopp(del) {
    Object.assign(_dkLage, del);
    const host = document.getElementById('dk-slutsatser');
    if (!host) return;
    if (!hamtaData().length) { host.innerHTML = ''; return; }
    const f = _dkLage.fardig || [], r = _dkLage.robust, n = _dkLage.block;
    const varna = f.filter(i => i.level === 'warn').length;
    const robust = r ? (r.flippar ? `${r.flippar} nära en gräns` : 'Står sig') : 'Inte körd';
    host.innerHTML = _laSlutsats('Färdigcheck', f.length ? `${f.length} ${f.length === 1 ? 'punkt' : 'punkter'}` : 'Inga lösa trådar',
            f.length ? (varna ? `${varna} behöver en åtgärd eller en förklaring` : 'Att känna till — inget som behöver åtgärdas') : 'Verktyget hittar inget som missats')
        + _laSlutsats('Robusthet', robust, r ? `${r.provade} slutsatser prövade på nytt` : 'Körs under Robusthet längre ned');
    _laNyckel('nyckel-dk-robusthet', robust);
    _laNyckel('nyckel-dk-rapportunderlag', n ? `${n} avsnitt` : '');
}

function ritaRobusthet() {
    const host = document.getElementById('robusthet-body');
    if (!host) return;
    _dkRitaTopp({ robust: null });
    if (!hamtaData().length) { host.innerHTML = ''; return; }
    const n = hamtaData().length;
    host.innerHTML = `
        <p>Analysen kör om slutsatserna med andra rimliga inställningar och visar vad som står sig.
        Den räknar om de tyngsta stegen flera gånger${n > 5000 ? ` — med ${n.toLocaleString('sv-SE')} rader i underlaget kan det ta en stund` : ''}.</p>
        <button type="button" class="btn btn-primary btn-sm" id="btn-run-robusthet">Kör robusthetsanalys</button>`;
}

function korRobusthet() {
    const host = document.getElementById('robusthet-body');
    if (!host || !hamtaData().length) return;
    host.innerHTML = '<p class="f-dampad">Beräknar — det kan ta en stund…</p>';
    // Låt webbläsaren rita om innan det blockerande arbetet startar.
    setTimeout(() => { try { _ritaRobusthetResultat(host); } finally { visningNy(); } }, 30);   // resultatet är nytt (ADR-81)
}

// Går alltid genom exportläget (ADR-51): djupräknaren håller skärmen i exportläget tills den sista pågående exporten är klar.
function _ritaRobusthetResultat(...a) { return medExportLage(() => __ritaRobusthetResultatExport.apply(null, /** @type {any} */ (a))); }
function __ritaRobusthetResultatExport(host) {
    const lv = robusthetLikvardighet();
    const prio = robusthetPrioritering();

    const stabilBadge = (hits, of) => hits >= of
        ? '<span class="rb-stable">stabil</span>'
        : `<span class="rb-flip">flippar (${hits}/${of})</span>`;

    // Par med en grupp under tröskeln namnges inte (samma regel som utanför fliken Likvärdigt arbete); antalet anges.
    const lvNot = lv && lv.not ? `<p class="gd-missing">${esc(lv.not)}</p>` : '';
    const lvHtml = (lv && lv.rows.length
        ? `<table class="data-table st-088"><thead><tr>
             <th>${stor(termFras(T.enhet, 'en', { adjektiv: 'kvinnodominerad' }))}</th><th class="t-mitt">Med i körningar</th><th>Bedömning</th></tr></thead>
           <tbody>${lv.rows.map(r => `<tr><td>${esc(r.label)}</td>
             <td class="t-mitt" data-sort-value="${r.hits}">${r.hits} av ${r.of}</td>
             <td>${stabilBadge(r.hits, r.of)}</td></tr>`).join('')}</tbody></table>`
        : `<p class="gd-missing">${lvNot ? 'Inga kandidatpar att namnge' : 'Inga kandidatpar för likvärdigt arbete'} i någon av körningarna.</p>`) + lvNot;

    const prioHtml = prio && prio.tooFew
        ? '<p class="gd-missing">Kräver två referenser (lönepolitiskt ställningstagande och extern statistik) för att kunna jämföras.</p>'
        : prio && prio.rows.length
            ? `<table class="data-table st-088"><thead><tr>
                 <th>${stor(T.enhet.en)}</th><th class="t-mitt">I topplistan</th><th>Bedömning</th></tr></thead>
               <tbody>${prio.rows.map(r => `<tr><td>${esc(r.label)}</td>
                 <td class="t-mitt" data-sort-value="${r.hits}">${r.hits} av ${r.of}</td>
                 <td>${stabilBadge(r.hits, r.of)}</td></tr>`).join('')}</tbody></table>`
            : '<p class="gd-missing">Ingen topplista kunde beräknas.</p>';

    host.innerHTML = `
        <p class="reg-caveat-inline"><strong>Så läser du panelen:</strong> en grupp som bara dyker upp i vissa körningar
        är inte "fel" — den ligger nära en gräns. Men den är svårare att försvara som säkerställd, och bör presenteras
        med det förbehållet.</p>
        <div class="gd-grid">
            <div class="gd-card"><h3>Likvärdigt arbete — om tröskeln flyttas (${lv ? lv.trösklar.join(' / ') + ' %' : ''})</h3>
                <p class="gd-note">Vilka grupper är kvar oavsett var gränsen för &quot;kvinnodominerad&quot; dras?</p>${lvHtml}</div>
            <div class="gd-card"><h3>Prioritering — spelar referensen roll?</h3>
                <p class="gd-note">Vilka grupper ligger i topplistan oavsett vilken referens som används?</p>${prioHtml}</div>
        </div>`;
    const rader = [...(lv ? lv.rows : []), ...(prio && !prio.tooFew ? prio.rows : [])];
    _dkRitaTopp({ robust: { provade: rader.length, flippar: rader.filter(r => r.hits < r.of).length } });
}

// ---- Rang 4: Färdigcheck ----------------------------------------------------

/**
 * Korsläser analysens fynd mot vad som faktiskt hanterats. Rena observationer.
 * @returns {Array<{id:string, level:'warn'|'info', title:string, detail:string, tab:string|null}>}
 */
function byggFardigcheck() {
    const out = [];
    const d = hamtaData();
    if (!d.length) return out;

    // 1. Flaggade grupper utan rad i handlingsplanen
    try {
        const ref = (typeof _valdPrioReferens === 'function') ? _valdPrioReferens() : 'statistik';
        const items = raknaPrioritering(ref) || [];
        const flagged = items.filter(i => i.diffPct < 0);
        // Av dem: de som ligger mer än granskningsgränsen under, alltså Prioriteringens Börja här och Under referens,
        // liten grupp (samma ord och samma gräns som nyckeltalen och matrisen där).
        const overGransen = items.filter(i => i.status === 'akut' || i.status === 'atgard').length;
        if (flagged.length) {
            out.push({
                id: 'flaggade-grupper', level: 'warn', tab: 'handlingsplan',
                title: `${flagged.length} grupp${flagged.length === 1 ? '' : 'er'} ligger under referensen`
                    + (overGransen ? `, varav ${overGransen} mer än ${_prioGrans(state.prioConfig.atgardThreshold)} under` : ''),
                detail: 'Varje sådan grupp behöver antingen en åtgärd i handlingsplanen eller en dokumenterad förklaring med sakliga skäl.'
            });
        }
    } catch (e) { rapporteraFel('Färdigcheck: flaggade grupper utan åtgärd', e); }

    // 2. BAS utan policyreferens
    if ((state.policy || []).length && typeof policyFor === 'function') {
        const utan = hamtaBasIntervall().filter(b => !policyFor(null, b));
        if (utan.length) {
            out.push({
                id: 'bas-utan-policy', level: 'warn', tab: 'benchmark',
                title: `${utan.length} ${ordForAntal(utan.length, T.niva)} saknar lönepolitisk referens`,
                detail: `Saknas: ${utan.join(', ')}. Grupper utan referens kan inte avvika — "inga avvikelser" kan betyda "ingen referens".`
            });
        }
    }

    // 3. Grupper under den inställda tröskeln (de redovisas inte i det som lämnar verktyget) som tillsammans är många
    try {
        const { grupper: maskerade, personer } = smaGrupperVid(d, kInstalld());
        if (personer > 0) {
            const andel = (personer / d.length) * 100;
            out.push({
                id: 'maskerade', level: andel > 20 ? 'warn' : 'info', tab: null,
                title: `${personer} personer (${svPct(andel, 0)}) ligger i ${maskerade} grupper som är för små för att redovisas`,
                detail: `De ingår i siffrorna per ${T.niva.en} men syns inte per ${T.enhet.en}. Vid hög andel bör du komplettera analysen per ${T.niva.en}.`
            });
        }
    } catch (e) { rapporteraFel('Färdigcheck: BAS utan referens eller maskerade grupper', e); }

    // 4. § 8-områden som lämnats tomma
    try {
        const areas = (typeof _bes8Omraden === 'function') ? _bes8Omraden() : [];
        const tomma = areas.filter(a => !a.status);
        if (tomma.length) {
            out.push({
                id: 'bes8-tomma', level: 'warn', tab: 'bestammelser',
                title: `${areas.length - tomma.length} av ${areas.length} områden i bedömningen av regler och praxis är ifyllda`,
                detail: 'Regler och praxis ska bedömas för samtliga områden innan kartläggningen är komplett.'
            });
        }
    } catch (e) { rapporteraFel('Färdigcheck: regler och praxis', e); }

    // 5. Yrkesgrupper utan motsvarighet i jämförelsestatistiken
    if ((state.statistik || []).length) {
        const aids = new Set(d.map(r => { return sifferprefixAvYrke(r.yrke) ?? r.yrke; }));
        const utan = [...aids].filter(a => !(state.statistik || []).some(s => s.aid === a));
        if (utan.length) {
            out.push({
                id: 'utan-benchmark', level: 'info', tab: 'benchmark',
                title: `${utan.length} ${ordForAntal(utan.length, T.enhet)} i ${T.niva.en} saknar motsvarighet i jämförelsestatistiken`,
                detail: `De kan inte jämföras externt. Kontrollera att ${T.kod.bfl} stämmer om antalet är oväntat högt.`
            });
        }
    }

    // 6. Datakvalitet
    try {
        const uk = (typeof bedomningUnderlag === 'function') ? bedomningUnderlag() : null;
        if (uk && uk.status !== 'ok') {
            out.push({
                id: 'datakvalitet', level: uk.status === 'kritisk' ? 'warn' : 'info', tab: 'dashboard',
                title: `Underlagets kvalitet: ${UK_ETIKETT[uk.status]}`,
                detail: uk.kriterier.filter(c => c.status !== 'ok').map(c => `${c.namn} — ${c.text}`).join(' · ')
            });
        }
    } catch (e) { rapporteraFel('Färdigcheck: underlagets kvalitet', e); }

    return out;
}

function ritaFardigcheck() {
    const host = document.getElementById('fardigcheck-body');
    if (!host) return;
    if (!hamtaData().length) { host.innerHTML = ''; _dkRitaTopp({ fardig: null }); return; }
    const items = byggFardigcheck();
    _dkRitaTopp({ fardig: items });
    if (!items.length) {
        host.innerHTML = `<div class="fc-clear">${ikon('bock')} Inga lösa trådar hittades. Kom ihåg att verktyget bara ser det som går att
            räkna — samverkan, sakliga skäl och dokumentation bedömer ni själva.</div>`;
        return;
    }
    host.innerHTML = `
        <p class="reg-caveat-inline">Detta är <strong>observationer, inte fel</strong>. Det kan finnas goda skäl att lämna
        punkter öppna — listan finns för att inget ska glömmas bort av misstag.</p>
        <ul class="fc-list">${items.map(i => `
            <li class="fc-item fc-${esc(i.level)}">
                <div class="fc-title">${i.level === 'warn' ? statusMarke('varning') : statusMarke('info', 'Att känna till')}${esc(i.title)}</div>
                <div class="fc-detail">${esc(i.detail)}</div>
                ${i.tab ? `<button type="button" class="btn-table-tool" data-goto-tab="${esc(i.tab)}">Gå dit</button>` : ''}
            </li>`).join('')}</ul>`;
}

export function ritaKvalitetssakring() {
    ritaRobusthet();      // visar bara startknappen — analysen är dyr
    ritaFardigcheck();    // billig, körs direkt
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartRobusthetFardigcheck() {
    document.addEventListener('click', e => {
        if (/** @type {HTMLElement} */ (e.target).closest('#btn-run-robusthet')) korRobusthet();
    });
}

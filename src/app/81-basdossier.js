// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 81-basdossier.js — "Ett BAS-intervall, en sida"
//
// Samlar det verktyget redan vet om ett BAS-intervall i rapportens ordning, så att avsnittet om intervallet kan
// skrivas utan att samla ihop det ur fem flikar: nyckeltal och läget mot ställningstagandet, yrkesgrupperna (som i
// Lika arbete), likvärdigt arbete, ålder, förra året (årsbokslutet, ADR-54) och en textversion.
//
// Ingen ny statistik: yrkesgrupperna och deras status kommer ur likaArbeteGrupper (src/lib/rapportunderlag.js) med
// Lika arbetes gränser, paren ur likvardighetResultat() och förra året ur state.forraArsbokslut. Vymodellen
// (src/lib/vymodell-basdossier.js, ADR-99) räknar och maskerar; här ritas den. Samma dialogmönster som gruppdossiern
// (80-gruppdossier.js).
//
// Dataskydd: skärmen följer läget (kTroskel(), ADR-51) som övriga flikar; könsuppdelade mått bara där båda könen når
// k. Textversionen lämnar verktyget och byggs därför i exportläget (basdossierText): grupper under k utelämnas och
// räknas upp utan lönemått.
// ====================================================================
import { personOrd } from '../lib/namn.js';
import { direktivMarkering } from '../lib/status.js';
import { svKr, svPct, svTal } from '../lib/talformat.js';
import { adjektiv, ordForAntal, stor, termFras } from '../lib/termer.js';
import { basdossierIntervall, vymodellBasdossier } from '../lib/vymodell-basdossier.js';
import { _fokusfallor, meddelaSkarmlasare, esc, slappFokus, fangaFokus } from './01-html-och-tillganglighet.js';
import { rapporteraFel } from './03-hjalpfunktioner.js';
import { ikon } from './03-ikoner.js';
import { navigeraTill } from './05-tabeller-och-lankar.js';
import { _konUtelamnatNot, _kSanktNot, _parUtelamnadeNot, kInstalld, kTroskel, statGolv } from './06-k-troskel.js';
import { kMaskNot } from './06-maskeringsnoter.js';
import { T } from './09-termer.js';
import { _STS_DIR_ETIKETT } from './10-diagramtema.js';
import { hamtaBasIntervall, hamtaData, kopieraTextTillUrklipp, policyFor, referensKortnamn, state } from './12-tillstand.js';
import { medExportLage } from './23-exportgrind.js';
import { likvardighetResultat } from './34-likvardigt-arbete.js';
import { _direktivITalcell, laLikaGrupper } from './41-lika-arbete.js';
import { harAlder } from './50-regressionsmodeller.js';
import { _hpBedomningar, _hpBedomningHtml } from './56-handlingsplan.js';
import { _abForandringText } from './73-arsbokslut.js';
import { stangGruppdossier, gruppNamn, oppnaGruppdossier } from './80-gruppdossier.js';

/** BAS-intervallen som får öppnas i dossiern: minst k personer, i intervallens ordning (basdossierIntervall i src/lib/vymodell-basdossier.js). */
export function basdossierKandidater() {
    return basdossierIntervall(hamtaData(), hamtaBasIntervall(), kTroskel());
}

const BD_STATUS_TEXT = { granska: 'Värt att granska', folj: 'Följ upp', balanserat: 'Balanserat', ejbedomd: 'Går ej att bedöma', liten: 'Könsuppdelningen är för liten' };
const BD_STATUS_KLASS = { granska: ['farg-granska', 'sok'], folj: ['farg-varning', 'oga'], balanserat: ['farg-ok', 'bock'], ejbedomd: ['f-dampad', 'streck'], liten: ['f-dampad', null] };

/**
 * Dossiern för ett BAS-intervall som ren data (vymodellBasdossier i src/lib/vymodell-basdossier.js), eller null när
 * intervallet saknas eller har färre än k personer. Här hämtas bara tillståndets delar.
 * @param {string} bas
 */
export function byggBasdossier(bas) {
    const k = kTroskel(), d = hamtaData();
    let likvardighet = null;
    try { likvardighet = likvardighetResultat(); }
    catch (e) { rapporteraFel('BAS-dossier: likvärdigt arbete', e); }
    return vymodellBasdossier(d, bas, { k, basIntervall: hamtaBasIntervall(), golv: statGolv(), kInstalld: kInstalld(),
        referens: policyFor(null, bas), referensNamn: referensKortnamn(), lika: laLikaGrupper(d, k), likvardighet,
        harAlder: harAlder(), forraBokslut: state.forraArsbokslut });
}

// ---- Rendering --------------------------------------------------------------

/** @type {string|null} */
let _bdVald = null;
/** Öppnar dossiern för ett BAS-intervall (eller det första), med fokus tillbaka till öppnaren när den stängs. */
export function oppnaBasdossier(bas, opener) {
    const modal = document.getElementById('basdossier-modal');
    if (!modal) return;
    ritaBasdossier(bas);
    modal.style.display = 'flex';
    if (typeof fangaFokus === 'function') fangaFokus(modal, opener || document.activeElement);
}
export function stangBasdossier() {
    const modal = document.getElementById('basdossier-modal');
    if (!modal || modal.style.display !== 'flex') return;
    if (typeof slappFokus === 'function') slappFokus(modal);
    modal.style.display = 'none';
}

function ritaBasdossier(bas) {
    const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById('basdossier-select'));
    const body = document.getElementById('basdossier-body');
    if (!sel || !body) return;
    const kand = basdossierKandidater();
    if (!kand.length) {
        sel.innerHTML = '';
        body.innerHTML = `<div class="flik-empty-state"><div class="empty-icon">${ikon('tomLada')}</div>
            <h3>Inga ${T.niva.fl} att visa</h3><p>${stor(adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.niva))} ${T.niva.en} når ${kTroskel()} ${personOrd(kTroskel())}, eller ingen lönefil är inläst.</p></div>`;
        return;
    }
    const onskat = bas || sel.value || _bdVald || kand[0].bas;
    sel.innerHTML = kand.map(x => `<option value="${esc(x.bas)}">BAS ${esc(x.bas)} (${svTal(x.n, 0)} personer)</option>`).join('');
    sel.value = kand.some(x => x.bas === onskat) ? onskat : kand[0].bas;
    _bdVald = sel.value;
    // Ett begärt intervall som inte (längre) når tröskeln öppnas inte i tysthet som ett annat: det sägs.
    if (bas && bas !== sel.value) meddelaSkarmlasare(`BAS ${bas} visas inte i dossiern: intervallet finns inte i underlaget eller har färre än ${kTroskel()} ${personOrd(kTroskel())}. Visar BAS ${sel.value}.`);
    const d = byggBasdossier(sel.value);
    body.innerHTML = d ? _bdRitaInnehall(d) : `<p class="f-dampad">${stor(T.niva.bf)} kunde inte läsas.</p>`;
    // Fokusfällan cachar de fokuserbara elementen; när innehållet byggs om medan dialogen är öppen läggs den om,
    // med samma öppnare och utan att flytta fokus. Fokus står kvar där det var (väljaren), i stället för att hoppa
    // till stängknappen.
    const modal = document.getElementById('basdossier-modal');
    if (modal && modal.style.display === 'flex') {
        const trap = _fokusfallor.get(modal), opener = trap ? trap.opener : null;
        if (trap) { modal.removeEventListener('keydown', trap.handler); _fokusfallor.delete(modal); }
        fangaFokus(modal, opener, { flyttaFokus: false });
    }
}

const _bdKr = v => svKr(v);
const _bdTecken = v => (v > 0 ? '+' : v < 0 ? '−' : '±');
const _bdPctTecken = v => (v == null ? '–' : `${_bdTecken(v)}${svPct(Math.abs(v), 1)}`);

function _bdRitaInnehall(d) {
    const card = (title, inner, note) => `<div class="gd-card bd-card"><h3>${title}</h3>${note ? `<p class="gd-note">${note}</p>` : ''}${inner}</div>`;
    const missing = txt => `<p class="gd-missing">${txt}</p>`;
    const k = d.k;

    // 1. Nyckeltal och läget mot ställningstagandet
    const nyckeltal = `<div class="gd-kpis">
            <div class="gd-kpi"><span>${svTal(d.n, 0)}</span><small>personer</small></div>
            <div class="gd-kpi"><span>${d.nKv} / ${d.nMa}</span><small>kvinnor / män (${svPct(d.andelKv, 0)} kvinnor)</small></div>
            <div class="gd-kpi"><span>${_bdKr(d.median)}</span><small>median</small></div>
            <div class="gd-kpi"><span>${_bdKr(d.p10)} – ${_bdKr(d.p90)}</span><small>P10 – P90</small></div>
        </div>`
        + (d.konOk ? `<p>Kvinnors median ${_bdKr(d.medKv)}, mäns ${_bdKr(d.medMa)}: kvinnors median är ${svPct(d.kvotPct, 1)} av mäns.</p>`
            : `<p class="gd-note">${esc(_konUtelamnatNot())}</p>`)
        + (d.referens
            ? `<table class="data-table st-088 bd-tabell"><thead><tr><th scope="col">Mot ${esc(d.referens.namn)}</th><th scope="col" class="t-hoger">P10</th><th scope="col" class="t-hoger">Median</th><th scope="col" class="t-hoger">P90</th></tr></thead><tbody>`
              + `<tr><th scope="row">Referensen</th><td class="t-tal">${_bdKr(d.referens.p10)}</td><td class="t-tal">${_bdKr(d.referens.med)}</td><td class="t-tal">${_bdKr(d.referens.p90)}</td></tr>`
              + `<tr><th scope="row">BAS ${esc(d.bas)}</th><td class="t-tal">${_bdKr(d.p10)}</td><td class="t-tal">${_bdKr(d.median)}</td><td class="t-tal">${_bdKr(d.p90)}</td></tr>`
              + `<tr><th scope="row">Skillnad</th><td class="t-tal">${_bdPctTecken(d.referens.diffPct.p10)}</td><td class="t-tal">${_bdPctTecken(d.referens.diffPct.med)}</td><td class="t-tal">${_bdPctTecken(d.referens.diffPct.p90)}</td></tr></tbody></table>`
            : missing('Inget ställningstagande har en rad för intervallet.'));

    // 2. Yrkesgrupperna
    const status = y => { const [klass, ik] = BD_STATUS_KLASS[y.status]; return `<span class="la-status ${klass}">${ik ? ikon(ik) : ''} ${BD_STATUS_TEXT[y.status]}</span>`; };
    const yrkesrad = y => `<tr><td>${esc(y.aid)}</td><td>${esc(String(y.yrke).replace(/^\d+\s*/, '') || y.yrke)}</td>`
        + `<td class="t-tal">${y.tot} (${y.nKv}/${y.nMa})</td>`
        + (y.samlad ? `<td colspan="3" class="t-mitt">Gruppens median ${_bdKr(y.medTot)}</td>`
            : `<td class="t-tal">${_bdKr(y.medKv)}</td><td class="t-tal">${_bdKr(y.medMa)}</td><td class="t-tal">${svPct(y.kvotPct, 1)}${_direktivITalcell(y.kvotPct)}</td>`)
        + `<td>${status(y)}${y.ocksaI.length ? `<br><span class="gd-note">${esc(_bdHelaYrketNot(y))}</span>` : ''}</td><td class="t-mitt">${y.dossierKey ? `<button type="button" class="btn-table-tool" data-bd-gruppdossier="${esc(y.dossierKey)}" aria-label="Öppna gruppdossiern för ${esc(y.yrke)}">Gruppdossier</button>` : ''}</td></tr>`;
    const yrken = (d.yrken.length
        ? `<div class="table-container"><table class="data-table st-088 bd-tabell" id="basdossier-yrken"><thead><tr><th scope="col">AID</th><th scope="col">${stor(T.namn.en)}</th><th scope="col" class="t-hoger">Antal (kv/mä)</th><th scope="col" class="t-hoger">Median kvinnor</th><th scope="col" class="t-hoger">Median män</th><th scope="col" class="t-hoger">Kvinnors median i % av mäns</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Gruppdossier</span></th></tr></thead><tbody>${d.yrken.map(yrkesrad).join('')}</tbody></table></div>`
        : missing(`${stor(adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.enhet))} ${T.enhet.en} i intervallet har både kvinnor och män att jämföra.`))
        + (d.yrkenUtelamnade.length ? kMaskNot(d.yrkenUtelamnade, `${T.enhet.en}|${T.enhet.fl}`) : '')
        + (d.ejJamforbara.length ? `<p class="gd-note">Inte jämförbara (ett kön har färre än två personer): ${esc(d.ejJamforbara.join(', '))}.</p>` : '');

    // 3. Likvärdigt arbete
    const parLista = lista => `<ul class="gd-list">${lista.map(p => `<li>${esc(gruppNamn({ aid: p.kvAid, yrke: p.kvLabel }))} (BAS ${esc(p.kvBas)}) mot ${esc(gruppNamn({ aid: p.maAid, yrke: p.maLabel }))} (BAS ${esc(p.maBas)}): ${_bdKr(p.kvMedian)} mot ${_bdKr(p.maMedian)}, skillnad ${_bdKr(p.gapKr)} (${svPct(p.gapPct, 1)})</li>`).join('')}</ul>`;
    const parNot = d.par.utelamnade ? `<p class="gd-note">${esc(_parUtelamnadeNot(d.par.utelamnade))}</p>` : '';
    const likvardigt = (d.par.kandidat.length || d.par.hierarkiska.length)
        ? (d.par.kandidat.length ? `<p><strong>Kandidatpar där ${termFras(T.enhet, 'bf', { adjektiv: 'kvinnodominerad' })} ligger i intervallet</strong></p>${parLista(d.par.kandidat)}` : `<p>Inga kandidatpar där ${termFras(T.enhet, 'bf', { adjektiv: 'kvinnodominerad' })} ligger i intervallet.</p>`)
          + (d.par.hierarkiska.length ? `<p><strong>Lägre krav, högre lön</strong> (${T.jamforelse.bf} ligger i ett lägre intervall)</p>${parLista(d.par.hierarkiska)}` : '') + parNot
        : (parNot || missing(`${stor(adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.enhet))} ${termFras(T.enhet, 'en', { adjektiv: 'kvinnodominerad' })} i intervallet ingår i en jämförelse av likvärdigt arbete.`));

    // 4. Ålder (inte när lönefilen saknar ålder, ADR-64)
    const alder = !d.alder ? '' : `<table class="data-table st-088 bd-tabell"><thead><tr><th scope="col">Åldersgrupp</th><th scope="col" class="t-hoger">Antal (kv/mä)</th><th scope="col" class="t-hoger">Median</th><th scope="col" class="t-hoger">Median kvinnor</th><th scope="col" class="t-hoger">Median män</th></tr></thead><tbody>`
        + d.alder.map(a => `<tr><th scope="row">${esc(a.namn)}</th><td class="t-tal">${a.n} (${a.nKv}/${a.nMa})</td><td class="t-tal">${_bdKr(a.med)}</td><td class="t-tal">${_bdKr(a.medKv)}</td><td class="t-tal">${_bdKr(a.medMa)}</td></tr>`).join('')
        + `</tbody></table><p class="gd-note">Ett köns median står bara där båda könen i åldersgruppen har minst ${k} ${personOrd(k)}.</p>`
        + `<p><button type="button" class="btn-table-tool" data-bd-alder="${esc(d.bas)}">${ikon('pilUt', 14)} Ålder &amp; karriär för BAS ${esc(d.bas)}</button></p>`;

    // 5. Förra året
    const f = d.forra;
    let forra;
    if (f.lage === 'ok') {
        const r = f.rad;
        forra = `<table class="data-table st-088 bd-tabell"><thead><tr><th scope="col">Mått</th><th scope="col" class="t-hoger">${f.ar}</th><th scope="col" class="t-hoger">I år</th><th scope="col" class="t-hoger">Förändring</th></tr></thead><tbody>`
            + `<tr><th scope="row">Antal</th><td class="t-tal">${r.n.forra ?? '–'}</td><td class="t-tal">${r.n.nu ?? '–'}</td><td class="t-tal">${r.n.diff == null ? '–' : `${_bdTecken(r.n.diff)}${Math.abs(r.n.diff)}`}</td></tr>`
            + [['p10', 'P10'], ['med', 'Median'], ['p90', 'P90'], ['medKv', 'Median kvinnor'], ['medMa', 'Median män']].map(([m, e]) => `<tr><th scope="row">${e}</th><td class="t-tal">${_bdKr(r[m].forra)}</td><td class="t-tal">${_bdKr(r[m].nu)}</td><td class="t-tal halvfet">${_abForandringText(r[m])}</td></tr>`).join('')
            + '</tbody></table>';
    } else forra = missing(_bdForraText(f));

    return `
        <div class="gd-head">
            <h3 class="fs-lg marg-0">${stor(T.niva.en)} ${esc(d.bas)}</h3>
            <span class="gd-sub">${svTal(d.n, 0)} personer · ${d.yrken.length} ${ordForAntal(d.yrken.length, T.enhet)}</span>
            <button type="button" class="btn-table-tool" id="btn-basdossier-copy" title="Kopiera dossiern som text, i rapportens form">${ikon('kopiera', 14)} Kopiera som text</button>
        </div>
        <div class="bd-stack">
            ${(() => { const hp = _hpBedomningHtml(_hpBedomningar(([kalla, , bas]) => (kalla === 'prio' || kalla === 'par') && bas === String(d.bas)), { medGrupp: true });
                return hp ? card('Bedömning i handlingsplanen', hp, 'Dossiern dokumenterar inte sakliga skäl. Skälen dokumenterar du i Handlingsplan.') : ''; })()}
            ${card('Nyckeltal', nyckeltal)}
            ${card(stor(T.enhet.bfl) + ' i intervallet', yrken, 'Samma gränser som i Lika arbete, räknade på intervallets personer. Könsuppdelade mått bara där båda könen når minsta gruppstorlek.')}
            ${card('Likvärdigt arbete i intervallet', likvardigt)}
            ${d.alder ? card('Ålder', alder) : ''}
            ${card('Förra året', forra)}
        </div>`;
}

/** Noten för en AID-etikett som också finns i andra BAS-intervall: där är den en egen grupp i Lika arbete (ADR-89). */
function _bdHelaYrketNot(y) {
    return `${stor(T.enhet.bf)} finns också i ${y.ocksaI.map(b => `BAS ${b}`).join(', ')}, som en egen grupp i Lika arbete`;
}

/** Raden i punkt 5 när det inte finns något att jämföra med. */
function _bdForraText(f) {
    if (f.lage === 'saknasFalt') return `Förra årets bokslut (${f.ar}) sparades med en äldre version av verktyget och saknar raderna per ${T.niva.en}. Årets konfigurationsfil har dem.`;
    if (f.lage === 'saknasIntervall') return `Förra årets bokslut (${f.ar}) har ingen rad för intervallet: det hade färre än minsta gruppstorlek eller fanns inte.`;
    return 'Inget årsbokslut inläst. Konfigurationsfilen bär bokslutet: läs in förra årets fil i Spara och jämför år, så står intervallets rad här.';
}

/**
 * Textens stycken för ett BAS-intervall, i rapportens ordning: en rubrik och raderna under den per punkt. En enda
 * textbyggare för dossierns textkopia (basdossierSomText), rapportutkastet i Rapporttext (basintervallUtkastText),
 * avsnittet Lönekartläggning per BAS-intervall i Word och PDF (58-rapportmodell.js) och rapportunderlagets block
 * per intervall (67-rapportunderlag.js), så att de inte kan säga olika saker. Modellen ska vara byggd i exportläget:
 * grupper under k står då bara med namn bland de utelämnade.
 * @param {any} d modellen ur byggBasdossier
 * @param {{forraBaraMedBokslut?: boolean}} [val] forraBaraMedBokslut: punkten Förra året bara när ett bokslut är
 *   inläst (rapporten); dossiern säger annars hur man får ett
 * @returns {{rubrik: string, rader: string[]}[]}
 */
export function basdossierStycken(d, { forraBaraMedBokslut = false } = {}) {
    const kr = _bdKr;
    const ut = [];
    const nyckeltal = [`${svTal(d.n, 0)} personer, ${d.nKv} kvinnor och ${d.nMa} män (${svPct(d.andelKv, 0)} kvinnor). Medianlön ${kr(d.median)}, P10–P90 ${kr(d.p10)}–${kr(d.p90)}.`
        + (d.konOk ? ` Kvinnors median ${kr(d.medKv)} och mäns ${kr(d.medMa)}: kvinnors median är ${svPct(d.kvotPct, 1)} av mäns.` : ` ${_konUtelamnatNot()}`)];
    if (d.referens) nyckeltal.push(`Mot ${d.referens.namn}: P10 ${kr(d.p10)} mot ${kr(d.referens.p10)} (${_bdPctTecken(d.referens.diffPct.p10)}), median ${kr(d.median)} mot ${kr(d.referens.med)} (${_bdPctTecken(d.referens.diffPct.med)}), P90 ${kr(d.p90)} mot ${kr(d.referens.p90)} (${_bdPctTecken(d.referens.diffPct.p90)}).`);
    ut.push({ rubrik: 'Nyckeltal', rader: nyckeltal });

    const yrken = [];
    if (!d.yrken.length) yrken.push(`${stor(adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.enhet))} ${T.enhet.en} i intervallet har både kvinnor och män att jämföra.`);
    for (const y of d.yrken) {
        const antal = `${y.tot} personer (${y.nKv} kvinnor, ${y.nMa} män)`;
        yrken.push((y.samlad
            ? `- ${y.yrke}: ${antal}. Gruppens median ${kr(y.medTot)}; könsuppdelningen är för liten för en jämförelse.${y.ocksaI.length && y.status !== 'liten' ? ` ${BD_STATUS_TEXT[y.status]}.` : ''}`
            : `- ${y.yrke}: ${antal}. Kvinnor ${kr(y.medKv)}, män ${kr(y.medMa)}; kvinnors median ${svPct(y.kvotPct, 1)} av mäns${direktivMarkering(y.kvotPct) ? ` (${_STS_DIR_ETIKETT}, direktivmarkering)` : ''}. ${BD_STATUS_TEXT[y.status]}.`)
            + (y.ocksaI.length ? ` ${_bdHelaYrketNot(y)}.` : ''));
    }
    if (d.yrkenUtelamnade.length) yrken.push(`Redovisas inte (färre än ${d.k} ${personOrd(d.k)}): ${d.yrkenUtelamnade.join(', ')}.`);
    if (d.ejJamforbara.length) yrken.push(`Inte jämförbara (ett kön har färre än två personer): ${d.ejJamforbara.join(', ')}.`);
    ut.push({ rubrik: `${stor(T.enhet.bfl)} i intervallet`, rader: yrken });

    const likvardigt = [];
    const par = p => `- ${gruppNamn({ aid: p.kvAid, yrke: p.kvLabel })} (BAS ${p.kvBas}) mot ${gruppNamn({ aid: p.maAid, yrke: p.maLabel })} (BAS ${p.maBas}): ${kr(p.kvMedian)} mot ${kr(p.maMedian)}, skillnad ${kr(p.gapKr)} (${svPct(p.gapPct, 1)}).`;
    if (d.par.kandidat.length) { likvardigt.push(`Kandidatpar där ${termFras(T.enhet, 'bf', { adjektiv: 'kvinnodominerad' })} ligger i intervallet:`); d.par.kandidat.forEach(p => likvardigt.push(par(p))); }
    if (d.par.hierarkiska.length) { likvardigt.push('Lägre krav, högre lön:'); d.par.hierarkiska.forEach(p => likvardigt.push(par(p))); }
    if (!d.par.kandidat.length && !d.par.hierarkiska.length) likvardigt.push(`${stor(adjektiv({ utrum: 'ingen', neutrum: 'inget', plural: 'inga' }, T.enhet))} ${termFras(T.enhet, 'en', { adjektiv: 'kvinnodominerad' })} i intervallet ingår i en jämförelse av likvärdigt arbete.`);
    if (d.par.utelamnade) likvardigt.push(_parUtelamnadeNot(d.par.utelamnade));
    ut.push({ rubrik: 'Likvärdigt arbete i intervallet', rader: likvardigt });

    if (d.alder) {
        const alder = d.alder.map(a => {
            const kon = a.medKv != null ? `, kvinnor ${kr(a.medKv)}, män ${kr(a.medMa)}` : '';
            return `- ${a.namn}: ${a.n} personer (${a.nKv} kvinnor, ${a.nMa} män)${a.med != null ? `, median ${kr(a.med)}${kon}` : ''}.`;
        });
        alder.push(`Ett köns median står bara där båda könen i åldersgruppen har minst ${d.k} ${personOrd(d.k)}.`);
        ut.push({ rubrik: 'Ålder', rader: alder });
    }

    const f = d.forra;
    if (f.lage === 'ok') {
        const r = f.rad;
        ut.push({ rubrik: 'Förra året', rader: [`Jämfört med ${f.ar}: antal ${r.n.forra ?? '–'} till ${r.n.nu ?? '–'}; `
            + [['p10', 'P10'], ['med', 'median'], ['p90', 'P90']].map(([m, e]) => `${e} ${kr(r[m].forra)} till ${kr(r[m].nu)} (${_abForandringText(r[m])})`).join('; ') + '.'] });
    } else if (!(forraBaraMedBokslut && f.lage === 'ingetBokslut')) ut.push({ rubrik: 'Förra året', rader: [_bdForraText(f)] });
    return ut;
}

/** Fältet att fylla i som avslutar ett intervall i rapportutkastet, Word-utkastet och rapportunderlaget. */
export const BD_BEDOMNING = `Bedömning: har skillnaderna mellan kvinnor och män i intervallets ${T.enhet.fl} sakliga skäl, och motsvarar lönen i ${termFras(T.enhet, 'bfl', { adjektiv: 'kvinnodominerad' })} kraven i arbetet? Ange åtgärd där det behövs.`;

/** Textens rader: rubriken "BAS-intervall X" och styckena, åtskilda av en tom rad. */
function _bdTextRader(d, val) {
    return [`${stor(T.niva.en)} ${d.bas}`, '', ...basdossierStycken(d, val).flatMap((s, i) => [...(i ? [''] : []), s.rubrik, ...s.rader])];
}

/**
 * Textversionen i rapportens form: rubriken "BAS-intervall X" och ett stycke per punkt. Byggs ur en modell som
 * byggts i exportläget (basdossierText), så grupper under k står bara med namn bland de utelämnade.
 */
function basdossierSomText(d) {
    const L = _bdTextRader(d);
    if (_kSanktNot()) L.push('', _kSanktNot());
    return L.join('\n');
}

/**
 * Intervallets stycke i rapportutkastet (Rapporttext): dossierns text, förra året bara när ett bokslut är inläst, och
 * raden att fylla i sist. Meningen om sänkt tröskel står en gång, sist i utkastet. Modellen byggs i exportläget.
 */
export function basintervallUtkastText(d) {
    return [..._bdTextRader(d, { forraBaraMedBokslut: true }), '', `[HR fyller i] ${BD_BEDOMNING}`].join('\n');
}

/**
 * Yrkesgruppstabellen i rapportens avsnitt och rapportunderlagets block: bara yrken där båda könen når k (de övriga
 * står i texten, med gruppens median eller bland de utelämnade). Talen som tal; den som ritar formaterar.
 * @param {any} d modellen ur byggBasdossier, byggd i exportläget
 */
export function basdossierYrkesrader(d) {
    return d.yrken.filter(y => !y.samlad).map(y => ({ aid: y.aid, yrke: String(y.yrke).replace(/^\d+\s*/, '') || String(y.yrke),
        nKv: y.nKv, nMa: y.nMa, medKv: y.medKv, medMa: y.medMa, kvotPct: y.kvotPct, status: BD_STATUS_TEXT[y.status] }));
}
export const BD_YRKESKOLUMNER = ['AID', stor(T.namn.en), 'Kvinnor / män', 'Median kvinnor', 'Median män', 'Kvinnors median i % av mäns', 'Status'];

/** BAS-intervallen med lönerader som inte når k: de nämns i rapporten och utkastet, utan mått (som i Lönestruktur). */
export function basdossierUtelamnade() {
    const d = hamtaData(), kand = new Set(basdossierKandidater().map(x => x.bas));
    return hamtaBasIntervall().filter(b => !kand.has(b) && d.some(r => r.bas === b && r.lon > 0));
}

/** Texten för ett BAS-intervall, byggd i exportläget (ADR-51); null när intervallet inte når den inställda tröskeln. */
function basdossierText(bas) {
    return medExportLage(() => { const d = byggBasdossier(bas); return d ? basdossierSomText(d) : null; });
}

/**
 * Knappen som öppnar dossiern, för tabellerna (Löneöversikten, Lönestrukturs tabell per BAS-intervall) och
 * gruppdossiern. `ikonEndast`: bara en ikon, som bevisknappen bredvid, så att radens rubrik har samma text som förut.
 */
export function basdossierKnapp(bas, { text = 'BAS-dossier', ikonEndast = false } = {}) {
    const attr = `type="button" data-open-basdossier="${esc(bas)}" aria-label="BAS-dossier för BAS ${esc(bas)}" title="BAS-dossier: allt om BAS ${esc(bas)} på en sida"`;
    return ikonEndast ? `<button ${attr} class="btn-evidence bd-oppna-ikon">${ikon('dokument')}</button>`
        : `<button ${attr} class="btn-table-tool bd-oppna">${esc(text)}</button>`;
}

/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */
export function uppstartBasdossier() {
    // ---- Wiring ----
    document.getElementById('basdossier-select')?.addEventListener('change', () => ritaBasdossier());
    // Knapparna i tabellraderna: fångas före radens egna lyssnare (fäll in/ut, markering), som inte ska reagera.
    document.addEventListener('click', e => {
        const btn = /** @type {HTMLElement} */ (e.target).closest && /** @type {HTMLElement} */ (e.target).closest('[data-open-basdossier]');
        if (!btn) return;
        e.preventDefault(); e.stopPropagation();
        const bas = btn.getAttribute('data-open-basdossier') || '';
        // Från gruppdossiern: den stängs först, så att fokus går tillbaka till det som öppnade den när BAS-dossiern stängs.
        const iGrupp = btn.closest('#dossier-modal');
        if (iGrupp) { stangGruppdossier(); oppnaBasdossier(bas); } else oppnaBasdossier(bas, btn);
    }, true);
    document.addEventListener('click', e => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (!t.closest) return;
        if (t.closest('[data-basdossier-close]')) { stangBasdossier(); return; }
        const grupp = t.closest('[data-bd-gruppdossier]');
        if (grupp) { stangBasdossier(); oppnaGruppdossier(grupp.getAttribute('data-bd-gruppdossier')); return; }
        const alder = t.closest('[data-bd-alder]');
        if (alder) {
            const bas = alder.getAttribute('data-bd-alder') || '';
            stangBasdossier();
            const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById('bas-select-kon'));
            if (sel && [...sel.options].some(o => o.value === bas)) sel.value = bas;
            navigeraTill('kon');
            return;
        }
        if (t.closest('#btn-basdossier-copy')) {
            const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById('basdossier-select'));
            const txt = sel ? basdossierText(sel.value) : null;   // texten lämnar verktyget (ADR-51)
            if (!txt) { alert(`${stor(T.niva.bf)} har färre än ${kInstalld()} ${personOrd(kInstalld())} och kopieras inte.`); return; }
            kopieraTextTillUrklipp(txt, () => meddelaSkarmlasare('BAS-dossiern kopierad.'));
        }
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && document.getElementById('basdossier-modal')?.style.display === 'flex') stangBasdossier();
    });
}

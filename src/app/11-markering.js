// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ====================================================================
// 11-markering.js — Länkade vyer: en markerad grupp framhävs i alla diagram
//
// Ett klick på ett märke som hör till ett BAS-intervall eller en yrkesgrupp (yrke inom BAS) markerar gruppen.
// Markeringen är gemensam för hela verktyget: varje diagram som ritar något för gruppen framhäver det och
// tonar ned resten, också i andra flikar, och tabellrader för gruppen framhävs. En rad nere till höger säger vad
// som är markerat och låter användaren öppna gruppdossiern eller ta bort markeringen. Ett klick till på samma
// grupp, eller Escape, tar bort den. Med Ctrl, Cmd eller Skift nedtryckt läggs gruppen TILL de markerade (eller
// tas bort ur dem), så att flera grupper kan jämföras.
//
// En datapunkt hör till en grupp genom fältet `markering` (se markeringFor): ['bas:C'] eller
// ['bas:C', 'grupp:207011|C']. Ett BAS framhäver sina yrkesgrupper; en yrkesgrupp framhäver sig själv och
// stapeln eller spannet för sitt BAS.
//
// Dataskydd: markeringen ändrar bara utseendet på märken som redan är ritade. Den ritar ingenting nytt, följer
// inte med i någon export (exporten ritas på nytt ur figuren) och sparas inte — den ligger i minnet och
// försvinner med "Rensa all data". Det går bara att markera det som går att klicka på, alltså det som visas.
// ====================================================================

let _markering = [];   // de markerade gruppernas nycklar, i den ordning de markerades

/** Fältet `markering` för en datapunkt: BAS-intervallet, och yrkesgruppen när `aid` är angiven. */
function markeringFor(bas, aid) {
    if (bas == null || bas === '') return [];
    const b = String(bas);
    if (aid == null || aid === '') return [`bas:${b}`];
    const m = String(aid).match(/^(\d+)/);
    return [`bas:${b}`, `grupp:${m ? m[1] : String(aid)}|${b}`];
}

/** De markerade gruppernas nycklar, eller null när inget är markerat. */
function diagramMarkering() { return _markering.length ? _markering.slice() : null; }

// Hör en datapunkt (eller tabellrad) med de här nycklarna till någon av de markerade grupperna?
function _mkTraff(nycklar, valda) {
    return (Array.isArray(valda) ? valda : [valda]).some(v => _mkTraffEn(nycklar, v));
}
function _mkTraffEn(nycklar, vald) {
    if (!Array.isArray(nycklar) || !nycklar.length) return false;
    if (nycklar.includes(vald)) return true;
    // En markerad yrkesgrupp framhäver också märket för sitt BAS, när märket gäller hela BAS-intervallet.
    if (vald.startsWith('grupp:')) {
        const bas = vald.slice(vald.indexOf('|') + 1);
        return nycklar.length === 1 && nycklar[0] === `bas:${bas}`;
    }
    return false;
}

function _mkEtikett(nyckel) {
    if (nyckel.startsWith('bas:')) return `BAS ${nyckel.slice(4)}`;
    const [aid, bas] = nyckel.slice(6).split('|');
    const rad = getData().find(r => r.bas === bas && String(r.yrke || '').startsWith(aid));
    return `${rad ? rad.yrke : aid} · BAS ${bas}`;
}

/**
 * Markerar gruppen med nyckeln. Utan `lagg` ersätter den det som är markerat (och ett klick till på den enda
 * markerade gruppen tar bort markeringen); med `lagg` läggs den till, eller tas bort om den redan är markerad.
 * `null` tar bort allt.
 */
function sattDiagramMarkering(nyckel, { lagg = false } = {}) {
    if (!nyckel) _markering = [];
    else if (lagg) _markering = _markering.includes(nyckel) ? _markering.filter(k => k !== nyckel) : [..._markering, nyckel];
    else _markering = _markering.length === 1 && _markering[0] === nyckel ? [] : [nyckel];
    if (typeof _rfMarkeraAlla === 'function') _rfMarkeraAlla();
    _mkTabeller();
    _mkRitaRad();
}

// ---- Tabeller ----
// En tabellrad hör till en grupp genom egenskapen `_markering` (satt av vyn; följer inte med när radens HTML
// kopieras till utskriften), data-markering (JSON-lista med nycklar), data-rad ("aid|bas", tabellen i
// Jämförelsestatistik) eller en knapp i raden som bär yrke och BAS (prioriteringstabellen).
function _mkRadNycklar(tr) {
    if (Array.isArray(tr._markering)) return tr._markering;
    if (tr.dataset.markering) { try { const n = JSON.parse(tr.dataset.markering); return Array.isArray(n) ? n : null; } catch (_e) { return null; } }
    if (tr.dataset.rad && tr.dataset.rad.includes('|')) { const [aid, bas] = tr.dataset.rad.split('|'); return markeringFor(bas, aid); }
    const knapp = tr.querySelector('[data-yrke][data-bas]');
    return knapp ? markeringFor(knapp.getAttribute('data-bas'), knapp.getAttribute('data-yrke')) : null;
}
/** Framhäver tabellraderna för de markerade grupperna. Anropas när markeringen ändras och när en flik har ritats. */
function _mkTabeller() {
    const valda = _markering;
    for (const tr of document.querySelectorAll('tbody tr')) {
        const nycklar = _mkRadNycklar(tr);
        const traff = !!(valda.length && nycklar && nycklar.length && _mkTraff(nycklar, valda));
        if (traff !== tr.classList.contains('rad-markerad')) tr.classList.toggle('rad-markerad', traff);
    }
}
// Ett klick på en tabellrad som hör till en grupp markerar den — men inte ett klick på en knapp, länk eller ett fält i raden.
document.addEventListener('click', e => {
    const t = e.target;
    if (!t || !/** @type {HTMLElement} */ (t).closest || /** @type {HTMLElement} */ (t).closest('button, a, input, select, label, textarea, summary')) return;
    const tr = /** @type {HTMLElement} */ (t).closest('tbody tr');
    if (!tr) return;
    const nycklar = _mkRadNycklar(tr);
    if (nycklar && nycklar.length) sattDiagramMarkering(nycklar[nycklar.length - 1], { lagg: e.ctrlKey || e.metaKey || e.shiftKey });
});

/**
 * Framhäver det markerade i ett ritat diagram: märken som hör till markeringen behåller sitt utseende och får
 * data-markerad, övriga märken med en grupp tonas ned. Ett diagram där inget märke hör till markeringen lämnas
 * orört — det har inget att säga om gruppen. Märken utan grupp (linjer, band, referenser) rörs aldrig.
 */
function _mkTillampa(el) {
    const figur = el && el._figur;
    if (!figur || !el.querySelector) return;
    const vald = _markering.length ? _markering : null;
    if (el._rfPensel) return;   // ett penslat område bestämmer just nu vilka punkter som framhävs i det här diagrammet
    const marken = [...el.querySelectorAll(':scope > svg [data-l][data-i]')].map(m => {
        const l = figur.lager[Number(m.getAttribute('data-l'))];
        const d = l && Array.isArray(l.data) ? l.data[Number(m.getAttribute('data-i'))] : null;
        return { m, nycklar: d && d.markering };
    }).filter(o => Array.isArray(o.nycklar) && o.nycklar.length);
    const traffar = vald ? marken.filter(o => _mkTraff(o.nycklar, vald)) : [];
    for (const o of marken) {
        const traff = traffar.includes(o);
        if (traffar.length && !traff) o.m.setAttribute('opacity', '0.22'); else o.m.removeAttribute('opacity');
        if (traff) o.m.setAttribute('data-markerad', ''); else o.m.removeAttribute('data-markerad');
    }
}

// Raden som säger vad som är markerat, med gruppdossiern (när EN yrkesgrupp med dossier är markerad) och Ta bort.
// Den står överst i innehållet, på samma plats i alla flikar, och följer med överst i fönstret när sidan rullas
// (position: sticky) — den ligger aldrig över det man läser.
function _mkPlacera(rad) {
    const yta = document.querySelector('.content-body') || document.body;
    if (rad.parentNode !== yta || yta.firstElementChild !== rad) yta.insertBefore(rad, yta.firstChild);
}
function _mkRitaRad() {
    let rad = document.getElementById('markering-rad');
    if (!_markering.length) { if (rad) rad.remove(); return; }
    if (!rad) {
        rad = document.createElement('div');
        rad.id = 'markering-rad';
        rad.className = 'markering-rad';
        rad.setAttribute('role', 'status');
        rad.addEventListener('click', e => {
            const knapp = /** @type {HTMLElement} */ (e.target).closest('button[data-markering]');
            if (!knapp) return;
            const vad = knapp.getAttribute('data-markering');
            if (vad === 'dossier') { const k = _mkDossierNyckel(); if (k) openGruppdossier(k); }
            else if (vad === 'borra') nedborrningTillUtforska();
            else sattDiagramMarkering(null);
        });
    }
    _mkPlacera(rad);
    rad.textContent = '';
    const text = document.createElement('span');
    const namn = _markering.map(_mkEtikett);
    text.textContent = `Markerat i alla diagram: ${namn.slice(0, 3).join(' · ')}${namn.length > 3 ? ` + ${namn.length - 3} till` : ''}`;
    text.title = namn.join('\n');
    rad.appendChild(text);
    if (_mkDossierNyckel()) rad.appendChild(_mkKnapp('dossier', 'Öppna gruppdossier'));
    if (_mkBorrBas() != null) {
        const b = _mkKnapp('borra', 'Visa yrkesgrupperna');
        b.title = 'Öppnar Utforska med yrkesgrupperna i BAS-intervallet. Där visas också grupper under tröskeln, markerade; de följer inte med i en export om du inte väljer det.';
        rad.appendChild(b);
    }
    rad.appendChild(_mkKnapp('rensa', 'Ta bort markeringen'));
    // Tipset står i verktygstipset på raden, inte som en egen text.
    rad.title = _markering.length === 1 ? 'Ctrl-klicka på en annan grupp för att lägga till den. Escape tar bort markeringen.' : 'Escape tar bort markeringen.';
}
function _mkKnapp(vad, text) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-table-tool';
    b.setAttribute('data-markering', vad);
    b.textContent = text;
    return b;
}
// Gruppdossiern finns bara för en yrkesgrupp med minst tröskeln personer.
function _mkDossierNyckel() {
    if (_markering.length !== 1 || !_markering[0].startsWith('grupp:')) return null;
    const nyckel = _markering[0].slice(6);
    return typeof gruppdossierCandidates === 'function' && gruppdossierCandidates().some(c => c.key === nyckel) ? nyckel : null;
}

// ---- Nedborrning: från ett markerat BAS-intervall till dess yrkesgrupper i Utforska ----
// Utforska öppnas med urvalet satt till BAS-intervallet och raderna "yrkesgrupp inom BAS". Det urval och de val
// användaren hade där innan sparas i minnet, så att raden ovanför diagrammet kan återställa dem och gå tillbaka
// till fliken man kom från. Utforska visar grupper under tröskeln markerade — raden säger det.
/** @type {any} */
let _mkTillbaka = null;   // { bas, urval, gruppVillkor, rad, kolumn, flik } eller null

function _mkBorrBas() {
    return _markering.length === 1 && _markering[0].startsWith('bas:') && typeof explorerSattUrval === 'function' ? _markering[0].slice(4) : null;
}
function nedborrningTillUtforska() {
    const bas = _mkBorrBas();
    if (bas == null) return;
    const rad = document.getElementById('explore-rad'), kolumn = document.getElementById('explore-kolumn');
    if (!rad || !kolumn) return;
    const aktiv = document.querySelector('.nav-item.active');
    const innan = _mkTillbaka || { ...explorerUrval(), rad: /** @type {HTMLInputElement} */ (rad).value, kolumn: /** @type {HTMLInputElement} */ (kolumn).value, flik: aktiv ? aktiv.getAttribute('data-tab') : null };
    _mkTillbaka = { ...innan, bas };
    explorerSattUrval({ lage: 'alla', villkor: [{ falt: 'bas', op: 'enAv', varde: [bas] }] }, []);
    /** @type {HTMLInputElement} */ (rad).value = 'aidbas';
    /** @type {HTMLInputElement} */ (kolumn).value = 'ingen';
    _mkBorrRad();
    const nav = document.querySelector('.nav-item[data-tab="utforska"]');
    if (nav && nav !== aktiv) /** @type {HTMLElement} */ (nav).click(); else if (typeof renderExplorer === 'function') renderExplorer();
}
function nedborrningTillbaka() {
    const t = _mkTillbaka;
    if (!t) return;
    _mkTillbaka = null;
    explorerSattUrval(t.urval, t.gruppVillkor);
    const rad = document.getElementById('explore-rad'), kolumn = document.getElementById('explore-kolumn');
    if (rad) /** @type {HTMLInputElement} */ (rad).value = t.rad;
    if (kolumn) /** @type {HTMLInputElement} */ (kolumn).value = t.kolumn;
    _mkBorrRad();
    const nav = t.flik && t.flik !== 'utforska' ? document.querySelector(`.nav-item[data-tab="${t.flik}"]`) : null;
    if (nav) /** @type {HTMLElement} */ (nav).click(); else if (typeof renderExplorer === 'function') renderExplorer();
}
/** Glömmer vägen tillbaka ("Rensa all data"): det sparade urvalet namnger grupper. */
function nedborrningGlom() { _mkTillbaka = null; _mkBorrRad(); }
function _mkBorrRad() {
    const el = document.getElementById('explore-nedborrning');
    if (!el) return;
    el.textContent = '';
    el.hidden = !_mkTillbaka;
    if (!_mkTillbaka) return;
    el.appendChild(document.createTextNode(`Du kom hit från BAS ${_mkTillbaka.bas}: urvalet är satt till det BAS-intervallet och raderna till yrkesgrupp inom BAS. `
        + `Grupper med färre än ${kInstalld()} personer följer inte med i en export om du inte kryssar i rutan. `));
    const b = _mkKnapp('tillbaka', 'Tillbaka till föregående urval');
    b.addEventListener('click', nedborrningTillbaka);
    el.appendChild(b);
}

document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || document.querySelector('.modal[style*="flex"]')) return;
    if (typeof _rfPenselRensaAlla === 'function') _rfPenselRensaAlla();
    if (_markering.length) sattDiagramMarkering(null);
});

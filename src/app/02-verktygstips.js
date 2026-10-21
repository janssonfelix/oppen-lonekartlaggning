// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Diagrammens verktygstips: en portal i <body> ----
//
// Diagramkärnan (10-diagramritare.js, ADR-39) visar sina verktygstips i en gemensam portal med fast läge,
// så att ingen behållare med overflow kan klippa dem. Innehållet är alltid escapad HTML (_rfTipsHtml).

/** @type {HTMLElement|null} */
let _chartTipEl = null;
function _ensureChartTip() {
    if (_chartTipEl) return _chartTipEl;
    _chartTipEl = document.createElement('div');
    _chartTipEl.className = 'chart-tip-portal';
    _chartTipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(_chartTipEl);
    return _chartTipEl;
}

/**
 * Visar chart-tooltipen vid muspekarens position.
 * Använder fixed positioning så ingen overflow:auto-container kan klippa den.
 */
function _showChartTip(html, mouseX, mouseY) {
    if (!html) return;
    const tip = _ensureChartTip();
    tip.innerHTML = html;
    tip.classList.add('visible');
    tip.style.visibility = 'hidden';
    tip.style.left = '0px';
    tip.style.top = '0px';
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const margin = 8, gap = 14;
    // Default: ovanför + till höger om muspekaren
    let left = mouseX + gap;
    let top  = mouseY - th - gap;
    // Klampa: om för långt höger → till vänster om muspekaren
    if (left + tw > window.innerWidth - margin) left = mouseX - tw - gap;
    if (left < margin) left = margin;
    // Om för högt → under muspekaren istället
    if (top < margin) top = mouseY + gap;
    if (top + th > window.innerHeight - margin) top = window.innerHeight - th - margin;
    tip.style.left = left + 'px';
    tip.style.top  = top  + 'px';
    tip.style.visibility = '';
}

/**
 * Döljer OCH tömmer portalen: ett dolt tips lämnar ingen lönetext i sidan (Escape, rullning, ändrad
 * fönsterstorlek, pekaren lämnar diagrammet). _showChartTip sätter innehållet på nytt varje gång. Ett tips
 * som ägs av ett diagram ritat med diagramkärnan (ADR-39) släpper samtidigt sin ägare — _rfTipsDolt i 10-diagramritare.js (funktionsdeklaration: finns i hela bygget).
 */
function _hideChartTip() {
    if (_chartTipEl) {
        _chartTipEl.classList.remove('visible');
        _chartTipEl.textContent = '';
    }
    if (typeof _rfTipsDolt === 'function') _rfTipsDolt();
}

// Globalt: dölj (och töm) diagrammens verktygstips vid rullning, ändrad fönsterstorlek och Escape — när diagrammet
// rör sig under pekaren står tipset annars kvar på fel plats, med ett lönevärde i.
window.addEventListener('scroll', _hideChartTip, true);
window.addEventListener('resize', _hideChartTip);
document.addEventListener('keydown', e => { if (e.key === 'Escape') _hideChartTip(); });

// ---- Punkt-sampling för stora punktmoln (prestanda) ----
// Vid mycket stora underlag (tiotusentals rader) blir punktmolnet trögt och punkterna överlappar ändå till
// oläsbarhet. Diagramkärnan ritar då ett DETERMINISTISKT, jämnt fördelat urval (var k:te punkt) — ENBART
// visualiseringen. Alla statistiska mått räknas på FULL data före det steget.
const SCATTER_MAX_POINTS = 8000;

/**
 * Visar/uppdaterar en diskret notis under diagrammet när sampling är aktiv.
 * `chartId` är diagrammets id eller elementet självt; ett element utan id får notisen som nästa syskon.
 */
function _setScatterSampleNote(chartId, sampled) {
    const chart = typeof chartId === 'string' ? document.getElementById(chartId) : chartId;
    if (!chart) return;
    const noteId = chart.id ? chart.id + '-sample-note' : '';
    const granne = chart.nextElementSibling;
    // Notisen är elementet med notisens id, annars syskonet direkt efter diagrammet (ett diagram utan id, eller
    // ett som fick sitt id efter att notisen skapades). Ett syskon som bär ett ANNAT id är ett annat diagrams
    // notis och rörs inte.
    const grannens = !!granne && granne.classList.contains('scatter-sample-note') && (!granne.id || granne.id === noteId);
    let note = (noteId && document.getElementById(noteId)) || (grannens ? granne : null);
    if (!sampled) { if (note) note.remove(); return; }
    if (!note) {
        note = document.createElement('p');
        if (noteId) note.id = noteId;
        note.className = 'scatter-sample-note';
        note.setAttribute('role', 'note');
        note.style.cssText = 'font-size:0.8rem; color:var(--text-muted); margin:4px 0 0; font-style:italic;';
        chart.insertAdjacentElement('afterend', note);
    }
    const fmt = n => n.toLocaleString('sv-SE');
    note.textContent = `Visar ett representativt urval (${fmt(sampled.shown)} av ${fmt(sampled.total)} punkter) för prestanda — alla beräkningar använder fullständig data.`;
}

// ---- Tooltip portal: enskilt element i <body>, position:fixed ----
// Ett portalelement i stället för CSS-only `.info-tip::after`, som klipps av overflow:auto-tabeller
// och stacking-context från position:sticky/transform/etc. Lyssnar globalt
// på .info-tip[data-tooltip] via event delegation — fungerar även för
// element som renderas dynamiskt efter sidladdning.
/** @type {HTMLElement|null} */
let _tipPortal = null;
/** @type {HTMLElement|null} */
let _tipHost   = null;

function _ensureTipPortal() {
    if (_tipPortal) return _tipPortal;
    _tipPortal = document.createElement('div');
    _tipPortal.className = 'tip-portal';
    _tipPortal.setAttribute('role', 'tooltip');
    _tipPortal.id = 'tip-portal';
    document.body.appendChild(_tipPortal);
    return _tipPortal;
}

function _positionTip(host) {
    const tip = _tipPortal;
    if (!tip) return;
    const r = host.getBoundingClientRect();
    // Mät tooltip-storlek (synlig men osynlig för layout)
    tip.style.visibility = 'hidden';
    tip.classList.add('visible');
    tip.style.left = '0px';
    tip.style.top  = '0px';
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    // Standard: ovanför, centrerad
    let left = r.left + r.width / 2 - tw / 2;
    let top  = r.top - th - 8;
    // Klampa till viewport-kanter
    const margin = 8;
    if (left < margin) left = margin;
    if (left + tw > window.innerWidth - margin) left = window.innerWidth - tw - margin;
    // Vänd till nedanför om inte plats ovanför
    if (top < margin) top = r.bottom + 8;
    // Sista failsafe: om inte plats varken ovanför eller nedanför, klampa till topp
    if (top + th > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - th - margin);
    tip.style.left = left + 'px';
    tip.style.top  = top  + 'px';
    tip.style.visibility = '';
}

function _showTip(host) {
    if (!host || _tipHost === host) return;
    const text = host.getAttribute('data-tooltip');
    if (!text) return;
    // Om en annan tooltip visades → städa upp den först (annars läcker stolen-title)
    if (_tipHost && _tipHost !== host) {
        _tipHost.removeAttribute('aria-describedby');
        _restoreTitle(_tipHost);
    }
    _tipHost = host;
    const tip = _ensureTipPortal();
    tip.textContent = text;
    _positionTip(host);
    // Koppla aria-describedby till värd-elementet för skärmläsare
    if (!host.id) host.id = 'tip-host-' + Math.random().toString(36).slice(2, 8);
    host.setAttribute('aria-describedby', tip.id);
}

function _hideTip() {
    if (_tipPortal) _tipPortal.classList.remove('visible');
    if (_tipHost) {
        _tipHost.removeAttribute('aria-describedby');
        _restoreTitle(_tipHost);
    }
    _tipHost = null;
}

/**
 * Letar närmaste tooltip-värd för en mouseover/focus-event:
 *  1. Element med .info-tip[data-tooltip] (preferred pattern)
 *  2. Vilket element som helst med title="..." attribut — OS-native tooltip
 *     "stjäls" genom att flytta värdet till data-tooltip + portal, så
 *     OS-tooltipen inte kan dyka upp och täcka över portalen efter ~500ms.
 *
 * Vissa element undantas eftersom deras title= används för annat eller
 * skulle ge dålig UX i portalen (t.ex. <option>, <iframe>).
 */
function _findTipHost(target) {
    if (!target || !target.closest) return null;
    const dt = target.closest('[data-tooltip]');
    if (dt && dt.getAttribute('data-tooltip')) return dt;
    const t = target.closest('[title]');
    if (t && !['IFRAME','OPTION'].includes(t.tagName)) return t;
    return null;
}

/**
 * "Stjäl" title= attribut → flytta värdet till data-tooltip så OS-native
 * tooltip inte triggas. Original sparas i data-stolen-title för återställning.
 */
function _stealTitle(host) {
    if (!host.hasAttribute('title')) return;
    const t = host.getAttribute('title');
    if (!t) return;
    host.setAttribute('data-stolen-title', t);
    host.removeAttribute('title');
    if (!host.hasAttribute('data-tooltip')) {
        host.setAttribute('data-tooltip', t);
        host.setAttribute('data-tooltip-from-title', '1');
    }
}

/** Återställ title= från data-stolen-title. */
function _restoreTitle(host) {
    if (!host || !host.hasAttribute('data-stolen-title')) return;
    host.setAttribute('title', host.getAttribute('data-stolen-title'));
    host.removeAttribute('data-stolen-title');
    if (host.hasAttribute('data-tooltip-from-title')) {
        host.removeAttribute('data-tooltip');
        host.removeAttribute('data-tooltip-from-title');
    }
}

document.addEventListener('mouseover', e => {
    const host = _findTipHost(e.target);
    if (host) {
        _stealTitle(host);
        _showTip(host);
    }
});
document.addEventListener('mouseout', e => {
    // Hitta värd från ut-händelsen (kan vara delegerad descendant)
    const host = _findTipHost(e.target) || (/** @type {HTMLElement} */ (e.target).closest && /** @type {HTMLElement} */ (e.target).closest('[data-stolen-title]'));
    if (host && (!e.relatedTarget || !host.contains(e.relatedTarget))) {
        _hideTip();
        _restoreTitle(host);
    }
});
document.addEventListener('focusin', e => {
    const host = _findTipHost(e.target);
    if (host) {
        _stealTitle(host);
        _showTip(host);
    }
});
document.addEventListener('focusout', e => {
    const host = _findTipHost(e.target) || (/** @type {HTMLElement} */ (e.target).closest && /** @type {HTMLElement} */ (e.target).closest('[data-stolen-title]'));
    if (host) {
        _hideTip();
        _restoreTitle(host);
    }
});
// Dölj vid scroll/resize/escape — tooltipen följer inte med när värd-elementet flyttas
window.addEventListener('scroll', _hideTip, true);
window.addEventListener('resize', _hideTip);
document.addEventListener('keydown', e => { if (e.key === 'Escape') _hideTip(); });

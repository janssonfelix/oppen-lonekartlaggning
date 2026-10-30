// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- Tab Navigation ----
// En låst flik är aria-disabled, inte disabled: knappen går att nå och klicka på, skärmläsaren hör den och skälet, och
// klicket leder till lönefilskortet på Översikt i stället för att ingenting händer. Egenskapen `disabled` på knappen
// läser och sätter aria-disabled, så att resten av koden låser och låser upp flikar som vanligt (el.disabled = true).
document.querySelectorAll(".nav-item").forEach(btn => {
    Object.defineProperty(btn, 'disabled', {
        configurable: true,
        get() { return this.getAttribute('aria-disabled') === 'true'; },
        set(v) { if (v) this.setAttribute('aria-disabled', 'true'); else this.removeAttribute('aria-disabled'); }
    });
});
/** En låst flik har klickats: visa Översikt, rulla fram lönefilskortet, ge filväljaren fokus och markera kortet en stund. */
function visaLonefilskortet(flikNamn) {
    const oversikt = document.querySelector('.nav-item[data-tab="dashboard"]');
    if (oversikt && !oversikt.classList.contains('active')) /** @type {HTMLElement} */ (oversikt).click();
    const kort = document.getElementById('upload-cell-data');
    if (!kort) return;
    kort.scrollIntoView?.({ block: 'center' });
    kort.classList.add('visas-nu');
    setTimeout(() => kort.classList.remove('visas-nu'), 2000);
    document.getElementById('file-input-data')?.focus?.({ preventScroll: true });
    announceToScreenReader(`${flikNamn ? flikNamn + ' kräver ett underlag. ' : ''}Läs in lönefilen här på Översikt, så låses flikarna upp.`);
}
document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
        if (/** @type {HTMLInputElement} */ (btn).disabled) { visaLonefilskortet(btn.textContent.trim()); return; }
        const target = btn.getAttribute("data-tab");
        document.querySelectorAll(".view-panel").forEach(v => /** @type {HTMLElement} */ (v).style.display = "none");
        // Visa alla paneler i flikens grupp (sammanslagna flikar), annars panelen själv.
        (PANEL_GROUPS[target] || [target]).forEach(p => {
            const el = document.getElementById(`view-${p}`);
            if (el) el.style.display = "block";
        });
        document.querySelectorAll(".nav-item").forEach(t => t.classList.remove("active"));
        btn.classList.add("active");
        const titles = {
            dashboard: 'Översikt & Data',
            kon: 'Ålder & karriär', dokumentera: 'Dokumentera & exportera',
            benchmark: 'Jämförelse', matrix: 'Lika arbete',
            bestammelser: 'Regler & praxis',
            handlingsplan: 'Handlingsplan',
            prioritering: 'Prioritering',
            struktur: 'Struktur & rapportmått',
            loneoversyn: 'Löneöversyn',
            likvardighet: 'Likvärdigt arbete',
            utforska: 'Utforska',
            info: 'Om verktyget'
        };
        const titleEl = document.getElementById("page-title");
        if (titleEl) titleEl.textContent = titles[target] || target;
        renderTabContent(target);
    });
});

// ---- Tabs ----
// Sammanslagna flikar: en nav-knapp kan visa/rendera flera view-paneler.
// Panelerna ligger redan i rätt DOM-ordning (skevhet före matrix, kon före livscykel).
const PANEL_GROUPS = {
    matrix:      ['lika-yrken', 'skevhet', 'matrix'], // Lika arbete: yrkesgrupper → per BAS → justerat (regression/Oaxaca)
    kon:         ['kon', 'demografi', 'livscykel'],  // Ålder & karriär: kurvor per kön, demografi, gap över karriären
    utforska:    ['rapport', 'utforska'],            // Utforska: Löneöversikten (fast tabell) + egna vyer
    dokumentera: ['kvalitet', 'dokumentera']         // Dokumentera & exportera: färdigcheck + export + spara och läsa in arbetet
};
// Flikalias: namnen leds om till fliken som visar innehållet, så att inga länkar dör.
const TAB_ALIAS = { rapport: 'utforska', demografi: 'kon', kvalitet: 'dokumentera', lonepolitik: 'benchmark' };
function tabMal(namn) { return TAB_ALIAS[namn] || namn; }
function unlockTabs() {
    ['tab-kon','tab-matrix','tab-prioritering','tab-loneoversyn','tab-struktur','tab-likvardighet','tab-utforska'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        /** @type {HTMLInputElement} */ (el).disabled = false;
        // Låst läge visar "ladda upp först" i title. När fliken låses upp byts den
        // mot flikens egen förklaring (data-tip) — där lagrum/paragrafer bor, så
        // etiketten kan vara på klarspråk.
        const tip = el.getAttribute('data-tip');
        if (tip) el.setAttribute('title', tip); else el.removeAttribute('title');
    });
    synkaJamforelseFlik();
}

// Enda källan för "rendera innehållet i flik X". Anropas både av nav-klick och
// av refreshCurrentTab() så att de två aldrig glider isär. Datakrävande flikar
// gatas på getData().length; info-fliken renderar sin egen tomstatus.
// Sammanslagna flikar renderar bägge sina paneler (matrix→skevhet+regression,
// kon→kurvor+livscykel).
// Länkade vyer (11-markering.js): när en flik har ritats om framhävs dess tabellrader för de markerade grupperna.
function renderTabContent(target) {
    const flik = tabMal(target), yttre = !_ritasNu.has(flik);
    _ritasNu.add(flik);
    try {
        const ut = _renderTabContent(target);
        _ritadVid.set(flik, ritGeneration());     // exportgrinden (23-exportgrind.js): fliken är ritad med det som gäller nu
        return ut;
    }
    finally {
        if (yttre) _ritasNu.delete(flik);
        if (typeof _mkTabeller === 'function' && diagramMarkering()) _mkTabeller();
        // Fält som fliken skapade får autocomplete="off" redan nu (observatören i 01-html-och-tillganglighet.js
        // gör det annars strax efter).
        if (typeof stangAutofyll === 'function') stangAutofyll(document.getElementById('view-' + flik) || document);
    }
}
// Flikar som bara har något att visa när lönefilen är inläst. Nås en sådan utan underlag (en direktlänk, en
// konfigurationsfil) säger en rad överst vad som saknas, i stället för tomma rader.
const KRAVER_UNDERLAG = ['kon', 'matrix', 'prioritering', 'struktur', 'loneoversyn', 'utforska', 'benchmark'];
function _ritaIngetUnderlag(target, tomt) {
    const vy = document.getElementById('view-' + ((PANEL_GROUPS[target] || [target])[0]));
    if (!vy) return;
    let rad = vy.querySelector(':scope > .inget-underlag');
    if (!tomt || !KRAVER_UNDERLAG.includes(target)) { rad?.remove(); return; }
    if (rad) return;
    rad = document.createElement('p');
    rad.className = 'urvalsrad inget-underlag';
    rad.setAttribute('role', 'status');
    rad.innerHTML = 'Inget underlag inläst — <a href="#" data-go-to-tab="dashboard">läs in lönefilen på Översikt</a>.';
    vy.insertBefore(rad, vy.firstChild);
}
function _renderTabContent(target) {
    target = tabMal(target);
    const d = getData();
    _ritaIngetUnderlag(target, !d.length);
    if (target === "kon" && d.length) {
        const s = document.getElementById("bas-select-kon"); if (s) renderKon(/** @type {HTMLInputElement} */ (s).value); renderLifecycleAnalysis();
        const s2 = document.getElementById("bas-select-demo"); if (s2) renderDemografi(/** @type {HTMLInputElement} */ (s2).value);
    }
    else if (target === "benchmark"    && d.length) { renderReferensOverblick(); renderLonepolitik(); generateBenchmark(); }
    else if (target === "matrix"       && d.length) { generateSkevhet(); generateEUDirectiveMatrix(); renderPersonerAttGranska(); renderLikaArbeteTopp(); }
    else if (target === "prioritering" && d.length) renderPrioritering();
    else if (target === "struktur"     && d.length) renderStructure();
    else if (target === "loneoversyn"  && d.length) renderForecast();
    else if (target === "likvardighet" && (d.length || state.statistik.length)) renderLikvardighet();
    else if (target === "utforska"     && d.length) { generateRapport(); renderExplorer(); }
    else if (target === "dokumentera") medExportLage(() => { if (d.length) renderKvalitetssakring(); renderRapportunderlag(); renderExportBesked(); if (typeof renderArsjamforelse === 'function') renderArsjamforelse(); });   // allt här lämnar verktyget (ADR-51)
    else if (target === "dashboard" && d.length) renderOversiktDelar();
    else if (target === "info")  renderInfoTab();
    else if (target === "handlingsplan") renderHandlingsplanSeed();
    else if (target === "bestammelser") { if (typeof bes8Uppdatera === 'function') bes8Uppdatera(); }
    // Sidans navigering hör till fliken som visas. Ritas en annan flik (t.ex. för att
    // kopiera ett diagram därifrån) ska den synliga flikens rader inte flyttas.
    const aktiv = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
    if (aktiv && tabMal(aktiv) !== target) return;
    renderFlowNav(target);
}

// UX: "Nästa steg"-överlämning längst ner i analysflikarna så processkänslan
// (processkartans steg) följer med in i flikarna, inte bara på Översikt.
const FLOW_NEXT = {
    bestammelser: { tab: 'matrix',        label: 'Lika arbete' },
    matrix:       { tab: 'likvardighet',  label: 'Likvärdigt arbete' },
    likvardighet: { tab: 'struktur',      label: 'Struktur & rapportmått' },
    struktur:     { tab: 'prioritering',  label: 'Prioritering & åtgärder' },
    prioritering: { tab: 'loneoversyn',   label: 'Löneöversyn' },
    loneoversyn:  { tab: 'handlingsplan', label: 'Handlingsplan' },
    handlingsplan:{ tab: 'kon',           label: 'Ålder & karriär' },
    kon:          { tab: 'benchmark',     label: 'Jämförelse' },
    benchmark:    { tab: 'utforska',      label: 'Utforska' },
    utforska:     { tab: 'dokumentera',   label: 'Dokumentera & exportera' }
};
// Fördjupningen är valfri: ett sådant steg som är låst eller dolt hoppas över (Jämförelse utan referens, allt utan underlag).
const _FLOW_VALFRIA = ['kon', 'benchmark', 'utforska'];
function _flowNasta(target) {
    let next = FLOW_NEXT[target];
    while (next && _FLOW_VALFRIA.includes(next.tab) && /** @type {HTMLInputElement|null} */ (document.querySelector(`.nav-item[data-tab="${next.tab}"]`))?.disabled) next = FLOW_NEXT[next.tab];
    return next;
}
function renderFlowNav(target) {
    document.querySelectorAll('.flow-next-bar').forEach(el => el.remove());
    const next = _flowNasta(target);
    // bestammelser (§ 8) är statisk och alltid tillgänglig; övriga kräver data
    if (!next || (target !== 'bestammelser' && target !== 'handlingsplan' && !getData().length)) return;
    const view = document.getElementById('view-' + (PANEL_GROUPS[target] || [target]).at(-1));
    if (!view) return;
    const bar = document.createElement('div');
    bar.className = 'flow-next-bar';
    bar.innerHTML = `<span class="flow-next-label">Klar här?</span> <span>Nästa steg i kartläggningen:</span>`
        + `<button type="button" class="flow-next-btn" data-flow-tab="${next.tab}">${esc(next.label)}</button>`;
    view.appendChild(bar);
}
// Delegerad klick: knappar i Dokumentera som återanvänder navets exportknappar.
document.addEventListener('click', e => {
    const b = /** @type {HTMLElement} */ (e.target).closest('[data-dok-klick]');
    if (b) document.getElementById(/** @type {HTMLElement} */ (b).dataset.dokKlick || '')?.click();
});
// Delegerad klick: "Nästa steg"-knapparna leder till rätt flik via nav-klicket.
document.addEventListener('click', e => {
    const btn = /** @type {HTMLElement} */ (e.target).closest('[data-flow-tab]');
    if (!btn) return;
    const nav = document.querySelector(`.nav-item[data-tab="${tabMal(btn.getAttribute('data-flow-tab'))}"]`);
    if (nav && !/** @type {HTMLInputElement} */ (nav).disabled) { /** @type {HTMLElement} */ (nav).click(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

function refreshCurrentTab() {
    const active = document.querySelector('.nav-item.active');
    if (!active) return;
    const target = active.getAttribute('data-tab');
    updateDashboardStats();
    populateSelects();
    updateCompliance();
    renderUnderlagetsKvalitet();
    renderTabContent(target);
}

// Delegerad click-handler för "gå till flik X"-länkar i HTML-strängar
document.addEventListener('click', e => {
    const a = /** @type {HTMLElement} */ (e.target).closest('[data-go-to-tab]');
    if (!a) return;
    e.preventDefault();
    const target = /** @type {HTMLElement} */ (a).dataset.goToTab;
    if (target && typeof navigateTo === 'function') navigateTo(target);
    const ankare = /** @type {HTMLElement} */ (a).dataset.goToAnchor && document.getElementById(/** @type {HTMLElement} */ (a).dataset.goToAnchor || '');
    if (ankare && typeof ankare.scrollIntoView === 'function') ankare.scrollIntoView({ block: 'start' });
});

// ---- Menyn på smala skärmar ----
// Under 640 punkter ligger menyn utanför bild (se style.css). Knappen Meny öppnar den över innehållet; den stängs
// av ett val i menyn, av Escape och av ett klick utanför. Fokus går till menyn när den öppnas och tillbaka till
// knappen när den stängs. På bredare skärmar finns knappen inte, och koden gör ingenting.
function menyOppen() { return document.body.classList.contains('meny-oppen'); }
function sattMeny(oppen, { fokus = true } = {}) {
    const knapp = document.getElementById('btn-meny'), skugga = document.getElementById('meny-skugga');
    if (!knapp || oppen === menyOppen()) return;
    document.body.classList.toggle('meny-oppen', oppen);
    knapp.setAttribute('aria-expanded', String(oppen));
    if (skugga) skugga.hidden = !oppen;
    if (!fokus) return;
    if (oppen) /** @type {HTMLInputElement} */ ((document.querySelector('.nav-item.active') || document.querySelector('.nav-item:not([aria-disabled="true"])')))?.focus();
    else knapp.focus();
}
document.getElementById('btn-meny')?.addEventListener('click', () => sattMeny(!menyOppen()));
document.getElementById('meny-skugga')?.addEventListener('click', () => sattMeny(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && menyOppen()) sattMeny(false); });
document.getElementById('sidomeny')?.addEventListener('click', e => { if (/** @type {HTMLElement} */ (e.target).closest('.nav-item')) sattMeny(false, { fokus: false }); });
// Fönstret breddas medan menyn är öppen: läget nollställs, annars ligger skuggan kvar när menyn åter är en spalt.
if (typeof window.matchMedia === 'function') {
    const bred = window.matchMedia('(min-width: 641px)');
    const nollstall = () => { if (bred.matches) sattMeny(false, { fokus: false }); };
    if (bred.addEventListener) bred.addEventListener('change', nollstall);
}

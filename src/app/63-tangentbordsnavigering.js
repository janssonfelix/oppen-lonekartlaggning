// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- A11y: Sidopanels-NAVIGATION ----
// Sidopanelen är PRIMÄR navigation, inte ett ARIA-tabs-widget: <nav> ger
// navigation-landmärket och knapparna är vanliga knappar där den aktiva markeras
// med `aria-current="page"`. (En role="tablist"/"tab"-modell skulle krocka
// med den hopfällbara sekundärgruppens disclosure-knapp — aria-required-children,
// ADR-10 — eftersom en tablist bara får innehålla role="tab"-barn.) Alla nav-knappar
// ligger i naturlig Tab-ordning; pil-/Home/End-tangenter behålls som tillägg.
function setupTabA11y() {
    const tabs = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.nav-item')]);
    const syncCurrent = () => tabs.forEach(t => {
        if (t.classList.contains('active')) t.setAttribute('aria-current', 'page');
        else t.removeAttribute('aria-current');
    });
    tabs.forEach(tab => {
        const target = tab.getAttribute('data-tab');
        if (target) tab.setAttribute('aria-controls', (PANEL_GROUPS[target] || [target]).map(p => `view-${p}`).join(' '));
        tab.addEventListener('keydown', e => {
            // Dolda flikar (t.ex. Jämförelse utan statistik) och låsta flikar hoppas över.
            const enabled = tabs.filter(t => !/** @type {HTMLInputElement} */ (t).disabled && !t.hidden);
            const idx = enabled.indexOf(tab);
            let next = -1;
            // En låst flik går att nå med Tab men står inte i listan: därifrån går pilen till närmaste upplåsta flik åt det hållet.
            const plats = tabs.indexOf(tab);
            const fore = idx >= 0 ? idx - 1 : enabled.filter(t => tabs.indexOf(t) < plats).length - 1;
            const efter = idx >= 0 ? idx + 1 : fore + 1;
            if (/** @type {KeyboardEvent} */ (e).key === 'ArrowDown' || /** @type {KeyboardEvent} */ (e).key === 'ArrowRight') next = efter % enabled.length;
            else if (/** @type {KeyboardEvent} */ (e).key === 'ArrowUp' || /** @type {KeyboardEvent} */ (e).key === 'ArrowLeft') next = (fore + enabled.length) % enabled.length;
            else if (/** @type {KeyboardEvent} */ (e).key === 'Home') next = 0;
            else if (/** @type {KeyboardEvent} */ (e).key === 'End')  next = enabled.length - 1;
            if (next >= 0) {
                e.preventDefault();
                enabled[next].focus();
                enabled[next].click();
            }
        });
    });
    syncCurrent();
    // View-panelerna är innehållsregioner i <main> — fokuserbara programmatiskt
    // vid flikbyte (men ej i Tab-ordningen).
    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.setAttribute('tabindex', '-1');
    });
    // Synka aria-current vid klick (klass-toggling sker i navigationslogiken)
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', syncCurrent);
    });
    // aria-live på status-meddelanden
    ['data-status','policy-status','stat-status'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.setAttribute('role','status'); el.setAttribute('aria-live','polite'); }
    });
}

/**
 * ARIA APG Tabs: roving tabindex + pil-/Home/End-navigering för EN in-page-tablist.
 *
 * Sidopanelen är navigation (ADR-10) och använder INTE den här — den har egen
 * pilhantering och alla knappar i Tab-ordningen. Det här gäller de två äkta
 * tablistarna: info-sektionerna och benchmark-percentilerna. Båda hade korrekt
 * `role`/`aria-selected` men lät Tab stanna på varje knapp, vilket avviker från
 * mönstret och ger tio extra Tab-stopp innan man är förbi dem.
 *
 * Aktivering sker genom att klicka den nya knappen — de befintliga klick-
 * hanterarna sätter redan `active` och `aria-selected`, så mönstret läggs
 * ovanpå utan att duplicera den logiken.
 *
 * @param {HTMLElement[]} buttons - knapparna i tablisten, i DOM-ordning.
 */
function _wireTablistKeys(buttons) {
    if (!Array.isArray(buttons) || buttons.length < 2) return;
    // Endast den aktiva knappen ligger i Tab-ordningen. `fallback` används när
    // ingen knapp hunnit bli aktiv (t.ex. benchmark innan data är inläst).
    const sync = fallback => {
        let aktiv = buttons.findIndex(b => b.classList.contains('active'));
        if (aktiv < 0) aktiv = (fallback == null ? 0 : fallback);
        buttons.forEach((b, i) => { b.tabIndex = i === aktiv ? 0 : -1; });
    };
    buttons.forEach((btn, i) => {
        btn.addEventListener('keydown', e => {
            let next = -1;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % buttons.length;
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + buttons.length) % buttons.length;
            else if (e.key === 'Home') next = 0;
            else if (e.key === 'End') next = buttons.length - 1;
            if (next < 0) return;
            e.preventDefault();
            buttons[next].click();
            sync(next);
            buttons[next].focus();
        });
        btn.addEventListener('click', () => sync(i));
    });
    sync(0);
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Hopplänkar inom sidan ----
// Varje lång flik har avsnitt som fälls ut, och deras rubriker är innehållsförteckningen. Här finns hopplänkarna
// (data-hoppa-till), som rapportunderlagets förteckning använder.
// Delegerad klick: hoppa till ett avsnitt utan att ändra adressen.
document.addEventListener('click', e => {
    const a = /** @type {HTMLElement} */ (e.target).closest('[data-hoppa-till]');
    if (!a) return;
    e.preventDefault();
    const mal = document.getElementById(/** @type {HTMLElement} */ (a).dataset.hoppaTill || '');
    if (mal && typeof mal.scrollIntoView === 'function') mal.scrollIntoView({ block: 'start', behavior: 'smooth' });
});

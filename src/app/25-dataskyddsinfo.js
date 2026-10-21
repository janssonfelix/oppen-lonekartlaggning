// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson

// ---- GDPR info-modal (kompakt -> full info) ----
document.getElementById('gdpr-info-readmore')?.addEventListener('click', () => {
    const m = document.getElementById('gdpr-info-modal');
    if (m) { m.style.display = 'flex'; trapFocus(m); }
});
document.getElementById('gdpr-info-close')?.addEventListener('click', () => {
    const m = document.getElementById('gdpr-info-modal');
    if (m) { releaseFocus(m); m.style.display = 'none'; }
});
document.querySelector('#gdpr-info-modal .yrke-backdrop')?.addEventListener('click', () => {
    const m = document.getElementById('gdpr-info-modal');
    if (m) { releaseFocus(m); m.style.display = 'none'; }
});
// Esc-tangent för GDPR-modal
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('gdpr-info-modal')?.style.display === 'flex') {
        const m = /** @type {HTMLElement} */ (document.getElementById('gdpr-info-modal'));
        releaseFocus(m); m.style.display = 'none';
    }
});

// ---- GDPR-banner: visar lokal-bearbetning-status ----
function updateGdprBanner() {
    const banner = document.getElementById('gdpr-banner');
    const count  = document.getElementById('gdpr-banner-count');
    if (!banner || !count) return;
    const n = state.data.length;
    // Ett dataskyddsbesked åt gången: med data syns rutan i sidhuvudet, annars den gröna rutan.
    const kompakt = document.querySelector('.gdpr-info-compact');
    if (kompakt) /** @type {HTMLElement} */ (kompakt).hidden = n > 0;
    if (n > 0) {
        count.textContent = n.toLocaleString('sv-SE');
        banner.style.display = 'inline-flex';
    } else {
        banner.style.display = 'none';
    }
}

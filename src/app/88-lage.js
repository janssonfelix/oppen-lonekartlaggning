// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Två lägen ----
/**
 * Vägledande läge är verktyget som det är: varje flik förklarar sig och "nästa steg" står sist. Kompakt läge är för
 * den som kan verktyget: förklaringarna är undanfällda och sidorna tätare (style.css, klassen lage-kompakt på sidan).
 * Samma avsnitt är utfällda i båda lägena — att fälla ut alla resultatavsnitt prövades och gav sidor på upp till
 * tretton skärmhöjder, alltså det som avsnitten finns till för att undvika.
 *
 * Läget väljs i panelen Inställningar (sidhuvudet har inte plats för en väljare till) och gäller tills sidan laddas om. Det lagras inte och följer inte med i någon fil.
 * Det ändrar bara vad som visas — inga tal, inga trösklar och ingen export. Noter om små grupper och förbehåll om
 * hur ett resultat ska läsas visas i båda lägena.
 */
let _lage = 'vagledande';
function lage() { return _lage; }   // eslint-disable-line no-unused-vars -- läses av testerna och av den som felsöker i konsolen

function sattLage(nytt) {
    const l = nytt === 'kompakt' ? 'kompakt' : 'vagledande';
    const andrat = l !== _lage;
    _lage = l;
    document.body.classList.toggle('lage-kompakt', l === 'kompakt');
    for (const [id, namn] of [['lage-vagledande', 'vagledande'], ['lage-kompakt', 'kompakt']]) {
        const k = document.getElementById(id);
        if (k) k.setAttribute('aria-pressed', String(l === namn));
    }
    if (andrat && typeof announceToScreenReader === 'function') announceToScreenReader(l === 'kompakt' ? 'Kompakt läge: förklaringarna är undanfällda.' : 'Vägledande läge: förklaringarna visas.');
}

document.getElementById('lage-vagledande')?.addEventListener('click', () => sattLage('vagledande'));
document.getElementById('lage-kompakt')?.addEventListener('click', () => sattLage('kompakt'));

// ---- Flikens inledning: en rad, resten bakom «Visa mer» ----
// Varje .flik-intro läggs i en rad med en knapp. Knappen visas bara när texten faktiskt är avkortad. Valet gäller
// fliken tills sidan laddas om; ingenting sparas. Anropas vid start och av flikar som bygger sin inledning själva.
function introRader(rot = document) {
    for (const intro of rot.querySelectorAll('.flik-intro')) {
        if (intro.parentElement && intro.parentElement.classList.contains('flik-intro-rad')) continue;
        const rad = document.createElement('div');
        rad.className = 'flik-intro-rad';
        /** @type {HTMLElement} */ (intro.parentNode).insertBefore(rad, intro);
        rad.appendChild(intro);
        const knapp = document.createElement('button');
        knapp.type = 'button';
        knapp.className = 'flik-intro-mer';
        knapp.setAttribute('aria-expanded', 'false');
        knapp.textContent = 'Visa mer';
        knapp.addEventListener('click', () => {
            const ut = !rad.classList.contains('ar-utfalld');
            rad.classList.toggle('ar-utfalld', ut);
            knapp.setAttribute('aria-expanded', ut ? 'true' : 'false');
            knapp.textContent = ut ? 'Visa mindre' : 'Visa mer';
        });
        rad.appendChild(knapp);
    }
}
introRader();

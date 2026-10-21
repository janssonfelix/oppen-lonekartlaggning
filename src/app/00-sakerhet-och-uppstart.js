// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Storage tripwire (defensiv mot framtida GDPR-regressioner) ----
// Verktyget får ALDRIG skriva till persistent lagring. Arkitekturellt löfte mot
// användaren (dataskydd.md §4). AKTIVT spärrat här: localStorage,
// sessionStorage (Storage.prototype) och document.cookie. IndexedDB/Cache API
// används inte av någon kod eller något bibliotek (D3/XLSX/PapaParse/JSZip)
// och täcks av kodgranskning + CSP, inte av denna runtime-spärr.
// Se riskanalys.md §6.2.
//
// Tripwiren wrappar de relevanta API:erna så att de kastar ett tydligt fel vid skrivförsök — setItem,
// direkt tilldelning och cookies. Läsförsök (vissa bibliotek känner efter om lagring finns) tillåts.
//
// Effekt: om en framtida bidragare introducerar `localStorage.setItem(...)`
// kastas ett tydligt fel direkt vid första bug-tillfället, istället för att
// regressionen smyger sig in i en release oupptäckt.
(function installStorageTripwire() {
    try {
        if (typeof Storage !== 'undefined' && Storage.prototype) {
            // Inget undantag: inget bibliotek i verktyget skriver till lagringen.
            Storage.prototype.setItem = function(key) {
                throw new Error(`Persistent storage forbidden (Storage.setItem("${key}")). Verktyget får inte skriva till localStorage/sessionStorage. Se dataskydd.md §4.`);
            };
        }
        // Direkt tilldelning (localStorage.x = …, sessionStorage['x'] = …) går inte genom setItem. Fönstrets två
        // lagringsobjekt byts därför mot ombud som kastar vid varje tilldelning och egenskapsdefinition; läsning,
        // removeItem och clear går vidare till den riktiga lagringen.
        for (const namn of ['localStorage', 'sessionStorage']) {
            try {
                const riktig = window[namn];
                if (!riktig) continue;
                const forbjudet = nyckel => { throw new Error(`Persistent storage forbidden (${namn}["${String(nyckel)}"] = …). Verktyget får inte skriva till localStorage/sessionStorage. Se dataskydd.md §4.`); };
                const ombud = new Proxy(riktig, {
                    get(mal, nyckel) { const v = Reflect.get(mal, nyckel); return typeof v === 'function' ? v.bind(mal) : v; },
                    set(_mal, nyckel) { return forbjudet(nyckel); },
                    defineProperty(_mal, nyckel) { return forbjudet(nyckel); }
                });
                Object.defineProperty(window, namn, { get: () => ombud, configurable: true });
            } catch (_e) { /* en webbläsare som inte låter egenskapen bytas: setItem-spärren ovan gäller ändå */ }
        }
        // document.cookie blockas explicit
        const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
        if (cookieDesc && cookieDesc.set) {
            Object.defineProperty(Document.prototype, 'cookie', {
                get: cookieDesc.get,
                set(_val) {
                    throw new Error('Persistent storage forbidden (document.cookie). Se dataskydd.md §4.');
                },
                configurable: true
            });
        }
    } catch (e) {
        // Vissa miljöer låser prototypes — då går vi vidare utan tripwire,
        // CSP + kodgranskning är fortfarande aktiva skydd.
        console.warn('Storage tripwire kunde inte installeras:', e.message);
    }
})();

// ---- Boot-splash teardown ----
// Tar bort initierings-spinnern så snart app.js har parsat klart + DOM är redo.
// Lite fördröjning så användaren faktiskt SER spinnern (annars hinner den blinka förbi
// på snabba maskiner). Min synlighet 200ms för WCAG-friendly perception.
(function hideBootSplash() {
    const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const hide = () => {
        const splash = document.getElementById('boot-splash');
        if (!splash) return;
        const elapsed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - start;
        const minVisible = 200;  // ms — undvik flash om allt är redan klart
        const wait = Math.max(0, minVisible - elapsed);
        setTimeout(() => {
            splash.style.transition = 'opacity 180ms ease-out';
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 200);
        }, wait);
    };
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        hide();
    } else {
        document.addEventListener('DOMContentLoaded', hide, { once: true });
    }
})();

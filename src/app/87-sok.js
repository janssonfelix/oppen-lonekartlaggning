// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// ---- Sök och hoppa ----
/**
 * Ett fält i sidhuvudet: skriv ett yrke eller ett BAS-intervall, välj en träff, och gruppen markeras i alla diagram
 * och tabeller (11-markering.js). Raden om markeringen bär länken till gruppdossiern.
 *
 * Fältet hittar också funktioner: flikarnas avsnitt, dialogerna och fälten i Inställningar, med synonymer
 * (registret i 86-sok-register.js). Det syns därför också utan lönefil; då visas bara funktioner. En funktion i en
 * flik som kräver lönefilen leder inte dit utan säger "kräver lönefil" och visar lönefilskortet, som menyn gör; med
 * lönefil men utan referens säger Löneläget "kräver referens eller jämförelsestatistik" och visar referenskortet.
 *
 * Dataskydd: bara grupper som får visas går att söka fram — BAS-intervall och yrkesgrupper med minst tröskeln
 * personer, samma urval som gruppdossiern och det som går att klicka på i diagrammen. En sökning som inte ger någon
 * träff säger inte om en mindre grupp finns. Söktexten sparas inte och lämnar inte sidan.
 */
const SOK_MAX_TRAFFAR = 8, SOK_MAX_FUNKTIONER = 5;
/** Träffarna i listan, grupperna först och funktionerna efter: { typ: 'grupp', nyckel, … }, { typ: 'basdossier', bas, namn }
 *  (raden under en BAS-träff som öppnar BAS-dossiern, 81-basdossier.js) eller { typ: 'funktion', …post i SOK_FUNKTIONER }. */
let _sokTraffar = [], _sokAktiv = -1;

/** Jämförelseform: gemener utan accenter och prickar, så att "skoterska" hittar "sköterska" (också utan svenskt tangentbord). */
function _sokNorm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

/** Allt som går att söka fram: BAS-intervall och yrkesgrupper som når tröskeln. */
function sokKandidater() {
    const d = getData();
    if (!d.length) return [];
    const perBas = new Map();
    for (const r of d) if (r.bas != null && r.bas !== '') perBas.set(r.bas, (perBas.get(r.bas) || 0) + 1);
    const ut = [...perBas].filter(([, n]) => !isKMasked(n)).sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'sv'))
        .map(([bas, n]) => ({ nyckel: `bas:${bas}`, namn: `BAS ${bas}`, under: 'BAS-intervall', n, sok: _sokNorm(`bas ${bas} bas-intervall ${bas}`) }));
    for (const g of gruppdossierCandidates()) {
        ut.push({ nyckel: `grupp:${g.key}`, namn: String(g.yrke || g.aid), under: `Yrkesgrupp · BAS ${g.bas}`, n: g.rows.length, sok: _sokNorm(`${g.yrke} ${g.aid} bas ${g.bas}`) });
    }
    return ut;
}

/** Träffarna för en söktext: varje ord i texten ska finnas i gruppens namn, kod eller BAS. Träffar i början av ett ord i namnet först (namnen börjar med AID-koden). */
function sokTraffar(text) {
    const ord = _sokNorm(text).split(' ').filter(Boolean);
    if (!ord.length) return [];
    return sokKandidater().filter(k => ord.every(o => k.sok.includes(o)))
        .map(k => ({ ...k, rang: _sokNorm(k.namn).split(' ').some(o => o.startsWith(ord[0])) ? 0 : 1 }))
        .sort((a, b) => a.rang - b.rang || b.n - a.n).slice(0, SOK_MAX_TRAFFAR);
}

/** Funktionerna för en söktext: varje ord ska finnas i postens namn eller synonymer. Träffar i början av ett ord i
 *  namnet först, sedan i början av en synonym, annars i registrets ordning. Högst SOK_MAX_FUNKTIONER. */
function sokFunktionsTraffar(text) {
    const ord = _sokNorm(text).split(' ').filter(Boolean);
    if (!ord.length) return [];
    const borjar = s => _sokNorm(s).split(/[\s/—–-]+/).some(o => o.startsWith(ord[0]));
    return SOK_FUNKTIONER.map((p, i) => ({ p, i }))
        .filter(({ p }) => { const sok = _sokNorm([p.namn, ...p.synonymer].join(' ')); return ord.every(o => sok.includes(o)); })
        .map(k => ({ ...k, rang: borjar(k.p.namn) ? 0 : k.p.synonymer.some(borjar) ? 1 : 2 }))
        .sort((a, b) => a.rang - b.rang || a.i - b.i).slice(0, SOK_MAX_FUNKTIONER).map(k => k.p);
}

function _sokHarData() { try { return getData().length > 0; } catch (_e) { return false; } }
/** Avsnittet är dolt i sin flik (hidden, display: none eller .dold utan inline-stil), fram till panelen. Ett avsnitt
 *  som fliken bygger när den ritas och som inte finns i sidan räknas som dolt, så att valet säger vad som saknas. */
function _sokMalDolt(p) {
    if (p.avsnitt && !document.getElementById(p.avsnitt)) return true;
    for (let n = p.avsnitt ? document.getElementById(p.avsnitt) : null; n && !n.classList.contains('view-panel'); n = n.parentElement) {
        if (n.hidden || n.style.display === 'none' || (n.classList.contains('dold') && !n.style.display)) return true;
    }
    return false;
}
/** Vad som behövs innan funktionen går att nå: 'lonefil' (fliken är låst, eller utan lönefil är målet dolt i sin
 *  flik, som exportraderna), 'referens' (lönefilen är inläst men fliken är ändå låst: Löneläget, som kräver en
 *  referens eller jämförelsestatistik, 38-referensfiler.js), annars ''. */
function _sokKraver(p) {
    if (p.dialog) return p.dialog === 'basdossier' && !_sokHarData() ? 'lonefil' : '';
    const nav = /** @type {HTMLInputElement|null} */ (document.querySelector(`.nav-item[data-tab="${p.flik}"]`));
    const har = _sokHarData();
    if (nav && nav.disabled) return har ? 'referens' : 'lonefil';
    return !har && _sokMalDolt(p) ? 'lonefil' : '';
}
const SOK_KRAVER_TEXT = { lonefil: 'kräver lönefil', referens: 'kräver referens eller jämförelsestatistik' };
const SOK_DIALOGNAMN = { installningar: 'Inställningar', ordlista: 'Ordlista', symboler: 'Förklaring', lagras: 'Vad lagras?', basdossier: 'BAS-dossiern' };
function _sokFlikNamn(flik) { return (document.querySelector(`.nav-item[data-tab="${flik}"]`)?.textContent || flik).trim(); }
function _sokFunktionUnder(p) {
    if (p.falt) return 'Fält i Inställningar';
    if (p.dialog) { const kraver = _sokKraver(p); return kraver ? `Öppnar ${SOK_DIALOGNAMN[p.dialog]} · ${SOK_KRAVER_TEXT[kraver]}` : `Öppnar ${SOK_DIALOGNAMN[p.dialog]}`; }
    const kraver = _sokKraver(p);
    return `I fliken ${_sokFlikNamn(p.flik)}${kraver ? ' · ' + SOK_KRAVER_TEXT[kraver] : ''}`;
}

function _sokRita() {
    const falt = document.getElementById('sok-grupp'), lista = document.getElementById('sok-grupp-lista');
    if (!falt || !lista) return;
    const text = /** @type {HTMLInputElement} */ (falt).value.trim();
    // Under varje BAS-träff en rad som öppnar BAS-dossiern: ett eget alternativ, så att pilarna och Retur når det.
    const kand = typeof basdossierKandidater === 'function' && _sokHarData() ? basdossierKandidater() : [];
    const grupper = sokTraffar(text).flatMap(t => {
        const bas = t.nyckel.startsWith('bas:') ? t.nyckel.slice(4) : null;
        if (bas != null && !kand.some(x => x.bas === bas)) return [{ ...t, typ: 'grupp' }];   // raden öppnar bara ett intervall som går att öppna
        return [{ ...t, typ: 'grupp' }, ...(bas != null ? [{ typ: 'basdossier', bas, namn: `Öppna BAS-dossiern för ${t.namn}` }] : [])];
    });
    const funktioner = sokFunktionsTraffar(text).map(p => ({ ...p, typ: 'funktion' }));
    _sokTraffar = [...grupper, ...funktioner];
    _sokAktiv = _sokTraffar.length ? 0 : -1;
    if (!text) { lista.hidden = true; lista.innerHTML = ''; falt.setAttribute('aria-expanded', 'false'); falt.removeAttribute('aria-activedescendant'); return; }
    // Grupperna följer ARIA-mönstret för en listbox med grupper: li[role=group] märkt med sin rubrik (en span med
    // role="presentation", inget alternativ, och pilarna går förbi den) och alternativen i en inre lista. Gruppen
    // Grupper behövs bara när båda finns; ensamma står grupperna direkt i listan.
    const grupp = (namn, id, innehall) => `<li role="group" aria-labelledby="${id}"><span role="presentation" class="sok-grupprubrik" id="${id}">${namn}</span>`
        + `<ul role="presentation" class="sok-grupplista">${innehall}</ul></li>`;
    const alt = (t, i) => t.typ === 'basdossier'
        ? `<li role="option" id="sok-traff-${i}" data-sok-index="${i}" data-sok-basdossier="${esc(t.bas)}" class="sok-underval" aria-selected="${i === _sokAktiv}"><span class="sok-namn">${esc(t.namn)}</span><span class="sok-under">Intervallet på en sida, i rapportens ordning</span></li>`
        : t.typ === 'grupp'
        ? `<li role="option" id="sok-traff-${i}" data-sok-index="${i}" aria-selected="${i === _sokAktiv}"><span class="sok-namn">${esc(t.namn)}</span><span class="sok-under">${esc(t.under)} · ${svTal(t.n, 0)} personer</span></li>`
        : `<li role="option" id="sok-traff-${i}" data-sok-index="${i}" data-sok-funktion aria-selected="${i === _sokAktiv}"><span class="sok-namn">${esc(t.namn)}</span><span class="sok-under">${esc(_sokFunktionUnder(t))}</span></li>`;
    lista.innerHTML = _sokTraffar.length
        ? (grupper.length && funktioner.length ? grupp('Grupper', 'sok-rubrik-grupper', grupper.map(alt).join('')) : grupper.map(alt).join(''))
            + (funktioner.length ? grupp('Funktioner', 'sok-rubrik-funktioner', funktioner.map((t, j) => alt(t, grupper.length + j)).join('')) : '')
        : `<li class="sok-ingen" role="presentation">${_sokHarData() ? 'Ingen grupp eller funktion matchar.' : 'Ingen funktion matchar.'}</li>`;
    lista.hidden = false;
    falt.setAttribute('aria-expanded', 'true');
    _sokMarkeraAktiv();
}
function _sokMarkeraAktiv() {
    const falt = /** @type {HTMLElement} */ (document.getElementById('sok-grupp'));
    document.querySelectorAll('#sok-grupp-lista [role="option"]').forEach((li, i) => li.setAttribute('aria-selected', String(i === _sokAktiv)));
    if (_sokAktiv >= 0) falt.setAttribute('aria-activedescendant', `sok-traff-${_sokAktiv}`); else falt.removeAttribute('aria-activedescendant');
}
function _sokStang({ tom = true } = {}) {
    const falt = document.getElementById('sok-grupp'), lista = document.getElementById('sok-grupp-lista');
    if (!falt || !lista) return;
    if (tom) /** @type {HTMLInputElement} */ (falt).value = '';
    lista.hidden = true; lista.innerHTML = '';
    falt.setAttribute('aria-expanded', 'false'); falt.removeAttribute('aria-activedescendant');
    _sokTraffar = []; _sokAktiv = -1;
}
/** En grupp markeras i alla diagram och tabeller; en grupp som redan är den enda markerade står kvar markerad.
 *  En funktion leder dit (_sokValjFunktion). */
function sokValj(i) {
    const t = _sokTraffar[i];
    if (!t) return;
    if (t.typ === 'funktion') { _sokValjFunktion(t); return; }
    if (t.typ === 'basdossier') { _sokStang(); openBasdossier(t.bas, document.getElementById('sok-grupp')); return; }
    const nu = diagramMarkering();
    if (!(nu && nu.length === 1 && nu[0] === t.nyckel)) sattDiagramMarkering(t.nyckel);
    _sokStang();
}
/** Leder till funktionen: avsnittet i sin flik (utfällt, med fokus), eller dialogen med fokus i fältet. En funktion
 *  som kräver lönefilen visar lönefilskortet i Filer och kvalitet, som ett klick på en låst flik i menyn; en som
 *  kräver en referens visar referenskortet. Är avsnittet dolt när fliken har ritats (det gäller inte underlaget)
 *  hamnar läsaren överst i fliken och får höra det, i stället för att fokus hamnar på något osynligt. */
function _sokValjFunktion(p) {
    _sokStang();
    const kraver = _sokKraver(p);
    if (kraver === 'lonefil') { visaLonefilskortet(p.namn); return; }
    if (kraver === 'referens') { visaReferenskortet(p.namn); return; }
    if (p.dialog === 'installningar') oppnaInstallningar({ fokus: p.falt || null });
    else if (p.dialog === 'ordlista') openGlossary();
    else if (p.dialog === 'lagras') openDataResidency();
    else if (p.dialog === 'basdossier') openBasdossier((basdossierKandidater()[0] || {}).bas || null, document.getElementById('sok-grupp'));
    else if (p.dialog === 'symboler') /** @type {HTMLElement|null} */ (document.getElementById('btn-open-symbols'))?.click();
    else {
        navigateTo(p.flik);
        if (!p.avsnitt) return;
        if (!_sokMalDolt(p)) { sidindexGaTill(p.avsnitt); return; }
        window.scrollTo(0, 0);
        /** @type {HTMLElement|null} */ (document.getElementById('main-content'))?.focus({ preventScroll: true });
        announceToScreenReader(`${p.namn} visas inte i fliken ${_sokFlikNamn(p.flik)} med det här underlaget.`);
    }
}
/** @type {boolean|null} */
let _sokHadeData = null;
/** Fältet syns alltid (utan lönefil hittar det funktionerna). När lönefilen läses in eller rensas stängs en öppen
 *  träfflista, så att den inte visar grupper som inte längre gäller. Anropas när data läses in, rensas eller tröskeln ändras. */
function sokUppdatera() {
    const har = _sokHarData();
    if (_sokHadeData !== null && har !== _sokHadeData) _sokStang();
    _sokHadeData = har;
}

document.getElementById('sok-grupp')?.addEventListener('input', _sokRita);
document.getElementById('sok-grupp')?.addEventListener('focus', () => { if (/** @type {HTMLInputElement} */ (document.getElementById('sok-grupp')).value.trim()) _sokRita(); });
document.getElementById('sok-grupp')?.addEventListener('keydown', e => {
    const oppen = !/** @type {HTMLElement} */ (document.getElementById('sok-grupp-lista')).hidden;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!_sokTraffar.length) return;
        e.preventDefault();
        _sokAktiv = (_sokAktiv + (e.key === 'ArrowDown' ? 1 : -1) + _sokTraffar.length) % _sokTraffar.length;
        _sokMarkeraAktiv();
    } else if (e.key === 'Enter') {
        if (_sokAktiv >= 0) { e.preventDefault(); sokValj(_sokAktiv); }
    } else if (e.key === 'Escape' && (oppen || /** @type {HTMLInputElement} */ (e.target).value)) {
        // Escape i fältet stänger listan; markeringen (som Escape annars tar bort) rörs inte.
        e.stopPropagation();
        _sokStang();
    }
});
document.getElementById('sok-grupp-lista')?.addEventListener('mousedown', e => e.preventDefault());   // fältet behåller fokus vid klick i listan
document.getElementById('sok-grupp-lista')?.addEventListener('click', e => {
    const li = /** @type {HTMLElement} */ (e.target).closest('[data-sok-index]');
    if (li) sokValj(Number(li.getAttribute('data-sok-index')));
});
document.getElementById('sok-grupp')?.addEventListener('blur', () => _sokStang({ tom: false }));
// Kortkommandon: "/" (utanför textfält) och Ctrl/Cmd+K sätter fokus i sökfältet.
document.addEventListener('keydown', e => {
    const falt = document.getElementById('sok-grupp'), ruta = document.getElementById('sok-ruta');
    if (!falt || !ruta || ruta.hidden) return;
    const iFalt = e.target && /** @type {HTMLElement} */ (e.target).matches && /** @type {HTMLElement} */ (e.target).matches('input, textarea, select, [contenteditable="true"]');
    const snabb = (e.key === '/' && !iFalt && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k');
    if (!snabb || document.querySelector('[role="dialog"][style*="flex"]')) return;
    e.preventDefault();
    falt.focus(); /** @type {HTMLInputElement} */ (falt).select();
});

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Organisationsfil: verktyget med organisationspaketet inbakat
 * (docs/utveckling/organisationsfil-design.md).
 *
 * Paketet läggs som en inaktiv datablock sist i HTML-filen, efter sista skriptet:
 *   <template id="(mallens id, MALL_ID)" data-skapad="…" data-organisation="…"
 *             data-verktygsversion="…" data-verktygssha="…">{ …JSON… }</template>
 * Ett <template> tolkas inte och exekveras inte; skriptens kontrollsummor i CSP:n är orörda eftersom
 * inget skript ändras. JSON-texten skrivs med `<` som \u003c och `&` som \u0026, så att den varken kan
 * avsluta elementet eller tolkas som en teckenreferens när appen läser den med textContent.
 *
 * Ren modul: bara strängar in och ut. Appen (29-organisationspaket.js) läser filen med FileReader,
 * laddar ner resultatet som Blob och läser vid start blocket ur DOM:en.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */

export const MALL_ID = 'inbakat-organisationspaket';
// Mallens öppningstagg byggs ihop av delar, så att den exakta strängen inte står i källkoden (som
// följer med i den byggda filen): en sökning efter blocket får bara träffa det riktiga blocket.
const MALL_START = '<' + 'template id="' + MALL_ID + '"';
const MALL_RE = new RegExp(MALL_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^>]*)>([\\s\\S]*?)<\\/template>');
// Blocket ligger alltid efter sista skriptet; bara den delen av filen söks och ändras, så att ett skript som
// råkar innehålla liknande text aldrig rörs.
const _delad = html => { const s = String(html ?? ''); const i = s.lastIndexOf('</script>'); return i < 0 ? ['', s] : [s.slice(0, i + 9), s.slice(i + 9)]; };
const VERSION_RE = /const APP_VERSION = '([0-9]{4}\.[0-9]{2}\.[0-9]{2})'/;
const CSP_RE = /<meta http-equiv="Content-Security-Policy"/;

const _attr = v => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const _avattr = v => String(v ?? '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Filnamnsförslag ur organisationens namn: oppen-lonekartlaggning-<slug>.html. */
export function filnamnForslag(organisation) {
    const slug = String(organisation ?? '').toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `oppen-lonekartlaggning-${slug || 'organisation'}.html`;
}

/** Ett filnamn som systemägaren skrivit: trimmat, utan sökvägstecken, med ändelsen .html. */
export function normaliseraFilnamn(namn, organisation) {
    let n = String(namn ?? '').trim().replace(/[\\/:*?"<>|]/g, '-');
    if (!n) return filnamnForslag(organisation);
    if (!/\.html?$/i.test(n)) n += '.html';
    return n;
}

/**
 * Är texten verktyget? Kräver CSP-metataggen och verktygets eget skript. Versionen läses ur
 * skriptet när den finns (den byggda filen); källans index.html saknar den.
 * @returns {{ok:boolean, version:string|null, fel?:string}}
 */
export function kannIgenVerktyget(html) {
    const s = String(html ?? '');
    if (!CSP_RE.test(s)) return { ok: false, version: null, fel: 'Filen är inte verktyget: innehållssäkerhetspolicyn saknas.' };
    if (s.lastIndexOf('</body>') < 0) return { ok: false, version: null, fel: 'Filen är inte verktyget: dokumentet är ofullständigt.' };
    const m = VERSION_RE.exec(s);
    return { ok: true, version: m ? m[1] : null };
}

/**
 * Läser det inbakade blocket ur en HTML-text.
 * @returns {null | {json:string, meta:{skapad:string, organisation:string, verktygsversion:string, verktygssha:string}}}
 */
export function lasUt(html) {
    const m = MALL_RE.exec(_delad(html)[1]);
    if (!m) return null;
    const attrs = {};
    for (const a of m[1].matchAll(/data-([a-z]+)="([^"]*)"/g)) attrs[a[1]] = _avattr(a[2]);
    return { json: m[2], meta: { skapad: attrs.skapad || '', organisation: attrs.organisation || '', verktygsversion: attrs.verktygsversion || '', verktygssha: attrs.verktygssha || '' } };
}

/**
 * Bakar in paketet i verktygsfilen. Ett tidigare inbakat paket ersätts. Inget skript rörs: blocket
 * läggs före sista </body> (biblioteken innehåller strängen '</body>' i sin kod, därför det sista).
 * @param {string} html - verktygsfilen som text
 * @param {string} paketJson - paketet som JSON-text (redan validerat av anroparen)
 * @param {{skapad?:string, organisation?:string, verktygssha?:string}} [meta]
 * @returns {{ok:true, html:string, version:string|null} | {ok:false, fel:string}}
 */
export function bakaIn(html, paketJson, meta = {}) {
    const k = kannIgenVerktyget(html);
    if (!k.ok) return { ok: false, fel: k.fel || 'Filen är inte verktyget.' };
    let obj;
    try { obj = JSON.parse(String(paketJson)); } catch (_e) { return { ok: false, fel: 'Paketet är inte giltig JSON.' }; }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, fel: 'Paketet är inte ett objekt.' };
    const text = JSON.stringify(obj).replace(/</g, '\\u003c').replace(/&/g, '\\u0026');
    const [huvud, svans0] = _delad(html);
    let svans = svans0.replace(MALL_RE, '');
    const slut = svans.lastIndexOf('</body>');
    if (slut < 0) return { ok: false, fel: 'Filen är inte verktyget: dokumentet är ofullständigt.' };
    const block = `${MALL_START} data-skapad="${_attr(meta.skapad)}" data-organisation="${_attr(meta.organisation)}"`
        + ` data-verktygsversion="${_attr(k.version || '')}" data-verktygssha="${_attr(meta.verktygssha)}">${text}</template>`;
    svans = svans.slice(0, slut) + block + svans.slice(slut);
    return { ok: true, html: huvud + svans, version: k.version };
}

/** Skriptblocken i en HTML-text, för tester som hävdar att inbakningen inte rör något skript. */
export function skriptBlock(html) {
    return [...String(html ?? '').matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(m => m[0]);
}

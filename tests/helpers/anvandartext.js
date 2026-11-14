// Det användaren läser i appens källa och i index.html, för vakterna över ordval: språkvakten
// (tests/dokumentation-sprak.test.js) och termvakten (tests/termer.test.js). Kommentarer, identifierare,
// sökregistrets synonymer och ordlistans sok-fält faller bort, så att de gamla orden går att söka på.
import { utanHtmlKommentarer, utanSkript, utanStil } from './htmlrens.js';

/** Källan utan kommentarer (block och rad; // inuti en sträng eller efter : står kvar). */
export const utanKommentarer = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

/**
 * Strängliteralerna som ser ut som text: med blanksteg eller med versal först. Identifierare som 'lonegapPct' och
 * id:n som 'gap-uppdelning' faller bort; uttryck i mallsträngar (${…}) blir blanksteg.
 */
export const textLiteraler = src => {
    const ut = []; const re = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g; let m;
    while ((m = re.exec(src))) ut.push(m[0].slice(1, -1).replace(/\$\{[^}]*\}/g, ' '));
    return ut.filter(l => /\s/.test(l) || /^[A-ZÅÄÖ]/.test(l));
};

/** Värden på etikett:, label: och rubrik: visas för användaren, också när de är ett gement ord. */
export const etikettVarden = src => [...src.matchAll(/\b(?:etikett|label|rubrik):\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)].map(m => m[2]);

/** En appfils källa utan kommentarer, synonymer och sok-fält; i Om verktyget också utan Källor. */
export const appKalla = (fil, src) => {
    let s = utanKommentarer(src).replace(/synonymer:\s*\[[^\]]*\]/g, '').replace(/sok:\s*'[^']*'/g, '');
    if (fil.endsWith('65-om-verktyget.js')) s = s.replace(/references: \(\) => `[\s\S]*?`/, '');   // Källor
    return s;
};

/** Attributen som användaren läser i index.html. */
export const LASTA_ATTRIBUT = ['title', 'aria-label', 'data-tooltip', 'alt', 'placeholder', 'data-export-label'];

/**
 * index.html som text: attribut som användaren läser (LASTA_ATTRIBUT och de som anges) står kvar som text också när
 * värdet är ett ord; övriga attribut utan blanksteg (id, klass) rensas.
 */
export const htmlText = (src, attribut = LASTA_ATTRIBUT) => utanStil(utanSkript(utanHtmlKommentarer(src), { medAttribut: true }))
    .replace(new RegExp(`\\s(?:${attribut.join('|')})="([^"]*)"`, 'g'), ' [$1] ')
    .replace(/\s[\w-]+="[^"\s]*"/g, '');

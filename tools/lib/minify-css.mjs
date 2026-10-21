// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Förminskning av stilmallen för bygget (tools/bundle.mjs).
 *
 * Att ta bort blanksteg runt { } ; : , > + ~ överallt ändrar betydelsen på tre sätt:
 *   - `calc(100% + 4px)` blir `calc(100%+4px)`, som är ogiltigt — deklarationen faller bort i webbläsaren;
 *   - `a :is(b)` blir `a:is(b)` — "b inuti a" blir "a som också är b", och regeln träffar ingenting;
 *   - `[style*="display: flex"]` blir `[style*="display:flex"]` — strängen i väljaren matchar inte.
 *
 * Förminskningen vet därför var den är:
 *   - strängar och url(...) rörs aldrig;
 *   - i en VÄLJARE tas blanksteg bort runt , > + ~ (kombinatorer) men aldrig före ett kolon;
 *   - i en DEKLARATION tas blanksteg bort efter egenskapens kolon och runt kommatecken, men aldrig runt + - * /;
 *   - i inledningen till en @-regel (t.ex. @media) tas bara blanksteg efter kolon och runt kommatecken bort.
 */

const GRUPPERANDE = /^@(media|supports|container|layer|document|scope|starting-style)\b/i;
const NYCKELRUTOR = /^@(-[a-z]+-)?keyframes\b/i;

/** Byter strängar, url(...) och kommentarer mot platshållare; ger texten och en funktion som sätter tillbaka dem. */
function skydda(css) {
    const sparat = [];
    let ut = '', i = 0;
    const lagg = s => { sparat.push(s); return `\u0000${sparat.length - 1}\u0000`; };
    while (i < css.length) {
        const c = css[i];
        if (c === '/' && css[i + 1] === '*') {                       // kommentar: bort
            const slut = css.indexOf('*/', i + 2);
            i = slut < 0 ? css.length : slut + 2;
            ut += ' ';
        } else if (c === '"' || c === "'") {                         // sträng
            let j = i + 1;
            while (j < css.length && css[j] !== c) { if (css[j] === '\\') j++; j++; }
            ut += lagg(css.slice(i, j + 1));
            i = j + 1;
        } else if (/^url\(/i.test(css.slice(i, i + 4)) && !/[a-z0-9_-]/i.test(css[i - 1] || '')) {   // url(...) utan citattecken
            let j = i + 4;
            while (j < css.length && /\s/.test(css[j])) j++;
            if (css[j] === '"' || css[j] === "'") { ut += css.slice(i, j); i = j; continue; }   // citerad: strängen skyddas i nästa varv
            const slut = css.indexOf(')', j);
            const till = slut < 0 ? css.length : slut + 1;
            ut += lagg(css.slice(i, till));
            i = till;
        } else { ut += c; i++; }
    }
    return { text: ut, tillbaka: s => s.replace(/\u0000(\d+)\u0000/g, (_m, n) => sparat[+n]) };
}

const ihop = s => s.replace(/\s+/g, ' ').trim();
const valjare = s => ihop(s).replace(/\s*([,>+~])\s*/g, '$1').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
const atInledning = s => ihop(s).replace(/:\s+/g, ':').replace(/\s*,\s*/g, ',').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
function deklarationer(s) {
    return s.split(';').map(d => {
        const t = ihop(d);
        if (!t) return '';
        const k = t.indexOf(':');
        if (k < 0) return t;
        // Egenskapens namn och värde: blanksteg bort efter kolonet och runt kommatecken, inget annat.
        return t.slice(0, k).trim() + ':' + t.slice(k + 1).trim().replace(/\s*,\s*/g, ',').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
    }).filter(Boolean).join(';');
}

/** Läser en lista med regler från `pos` till matchande } (eller textens slut). */
function regler(t, pos, nyckelrutor) {
    let ut = '';
    while (pos < t.length) {
        while (pos < t.length && /\s/.test(t[pos])) pos++;
        if (pos >= t.length) break;
        if (t[pos] === '}') return { ut, pos: pos + 1 };
        // Inledningen: fram till { eller ; (en @-regel utan block, t.ex. @import eller @charset)
        let j = pos, djup = 0;
        while (j < t.length && !(djup === 0 && (t[j] === '{' || t[j] === ';' || t[j] === '}'))) { if (t[j] === '(') djup++; else if (t[j] === ')') djup--; j++; }
        const inledning = t.slice(pos, j);
        if (j >= t.length || t[j] === '}') { pos = j; continue; }                 // skräp utan block: släpps
        if (t[j] === ';') { ut += atInledning(inledning) + ';'; pos = j + 1; continue; }
        const ar = ihop(inledning);
        if (GRUPPERANDE.test(ar) || NYCKELRUTOR.test(ar)) {
            const inre = regler(t, j + 1, NYCKELRUTOR.test(ar));
            ut += atInledning(inledning) + '{' + inre.ut + '}';
            pos = inre.pos;
        } else {
            // Ett deklarationsblock. (Nästlade regler används inte i stilmallen; blocket läses till sin matchande }.)
            let k = j + 1, d = 1;
            while (k < t.length && d > 0) { if (t[k] === '{') d++; else if (t[k] === '}') d--; k++; }
            const kropp = t.slice(j + 1, d === 0 ? k - 1 : k);
            ut += (ar.startsWith('@') ? atInledning(inledning) : nyckelrutor ? ihop(inledning).replace(/\s*,\s*/g, ',') : valjare(inledning)) + '{' + deklarationer(kropp) + '}';
            pos = k;
        }
    }
    return { ut, pos };
}

export function minifyCss(css) {
    const { text, tillbaka } = skydda(String(css));
    return tillbaka(regler(text, 0, false).ut);
}

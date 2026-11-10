// HTML utan kommentarer och skriptblock, för vakterna som granskar sidans markering och text. Varje borttagning
// upprepas tills inget ändras, så att resterna av ett borttaget stycke inte kan bilda ett nytt.

/** HTML utan kommentarer. Kommentaren slutar vid --> eller --!>, som i webbläsaren. */
export function utanHtmlKommentarer(html) {
    let s = String(html), forra;
    do { forra = s; s = s.replace(/<!--[\s\S]*?--!?>/g, ''); } while (s !== forra);
    return s;
}

/**
 * HTML utan skriptblock (taggnamnet i valfri skiftläge, sluttaggen med eller utan blanksteg och attribut). Utan `medAttribut`
 * tas bara <script> utan attribut bort: ett skriptelement med attribut står kvar, så att vakten ser attributen.
 */
export function utanSkript(html, { medAttribut = false } = {}) {
    const block = medAttribut ? /<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi : /<script>[\s\S]*?<\/script\b[^>]*>/gi;
    let s = String(html), forra;
    do { forra = s; s = s.replace(block, ''); } while (s !== forra);
    return s;
}

/** HTML utan stilblock (taggnamnet i valfri skiftläge, sluttaggen med blanksteg eller attribut). */
export function utanStil(html) {
    let s = String(html), forra;
    do { forra = s; s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style\b[^>]*>/gi, ''); } while (s !== forra);
    return s;
}

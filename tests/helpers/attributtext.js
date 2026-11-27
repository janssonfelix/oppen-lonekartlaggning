// Texten som står direkt i ett element, utan barnelementens: vakterna går igenom varje element och läser dess egen text,
// så att text bredvid ett barnelement («Median <b>(grupp)</b> 44 519 kr») ses, och varje text ses en gång.
export const egenText = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.data).join(' ');

// Ett elements attributvärden som text, för vakterna som letar belopp i sidan.
// I en SVG är lägesattributen (cx, cy, d, transform …) pixlar med många decimaler — siffersviter som av en slump
// kan likna ett belopp. De bär ingen lön och tas inte med; övriga attribut (aria-label, data-serie …) granskas.
const LAGE = /^(c?[xy][12]?|r|rx|d|width|height|transform|points|viewBox|stroke-dasharray)$/;
export function attributtext(el) {
    const svg = el.namespaceURI === 'http://www.w3.org/2000/svg';
    return Array.from(el.attributes).filter(a => !(svg && LAGE.test(a.name))).map(a => a.value).join(' ');
}

// Samma sak för SVG som text (en exporterad bild, eller ett elements outerHTML): lägesattributen tas bort, så att
// det som granskas är texten och de attribut som kan bära innehåll.
export function utanLagen(svgText) {
    return String(svgText).replace(/\s(?:c?[xy][12]?|r|rx|d|width|height|transform|points|viewBox|stroke-dasharray)="[^"]*"/g, '');
}

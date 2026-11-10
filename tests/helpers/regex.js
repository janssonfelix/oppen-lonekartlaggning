// En text som bokstavlig del av ett reguljärt uttryck: alla specialtecken escapas, inte bara punkten.
export function regexEscape(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

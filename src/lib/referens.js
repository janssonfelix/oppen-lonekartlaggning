// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — referensen (ställningstagandet).
 *
 * Det finns ingen inbyggd referens (ADR-28): ställningstagandet läses in som fil eller ur
 * ett organisationspaket. Modulen namnger en uppladdad fil.
 */

/** Förslag på namn för en uppladdad referensfil: filnamnet utan ändelse. */
export function namnFranFil(filnamn) {
    const s = String(filnamn ?? '').trim().replace(/\.[^.]*$/, '').trim();
    return s || 'Egen referens';
}

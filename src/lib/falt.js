// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Fältåtkomst för lönerader
 *
 * Gemensamma nycklar för hur en rad grupperas och jämförs: åldersgrupp,
 * normaliserat kön och gruppnyckel per dimension. Används av src/lib/utforska.js
 * (gruppering) och src/lib/urval.js (villkor), som inte får importera varandra.
 *
 * Webbläsarbygget får en AUTO-GENERERAD spegel i src/app/09-lib-speglar.js.
 */
import { sektorsnamn, mellannivaEtikett } from './aid.js';

const AGE_ORDER = ['<20', '20–24', '25–29', '30–34', '35–39', '40–44', '45–49',
                   '50–54', '55–59', '60–64', '65+'];

/** Ålder → 5-årsgrupp. Under 20 och från 65 får egna grupper. */
export function ageBucket(alder) {
    const n = Number(alder);
    if (alder == null || !isFinite(n) || n <= 0) return null;
    if (n >= 65) return '65+';
    if (n < 20) return '<20';
    const lo = 20 + Math.floor((n - 20) / 5) * 5;
    return `${lo}–${lo + 4}`;
}

/** Sorteringsfunktion för åldersgrupper: yngst först. */
export function jamforAldersgrupp(a, b) {
    return AGE_ORDER.indexOf(a) - AGE_ORDER.indexOf(b);
}

// Lönespann: 5 000 kr breda intervall, t.ex. "30 000–34 999 kr".
const LONESPANN_BREDD = 5000;
function _lonespann(lon) {
    const n = Number(lon);
    if (!(n > 0) || !isFinite(n)) return null;
    const lo = Math.floor(n / LONESPANN_BREDD) * LONESPANN_BREDD;
    return `${lo.toLocaleString('sv-SE')}–${(lo + LONESPANN_BREDD - 1).toLocaleString('sv-SE')} kr`;
}

/** Sorteringsfunktion för lönespann: lägst först. */
export function jamforLonespann(a, b) {
    const lagsta = s => Number(String(s).split('–')[0].replace(/\D/g, ''));
    return lagsta(a) - lagsta(b);
}

/** Normaliserat kön för gruppering och uppdelning. */
export function konOf(row) {
    if (typeof row.kon === 'string' && row.kon.includes('kvinna')) return 'Kvinna';
    if (row.kon === 'man' || row.kon === 'män') return 'Man';
    return 'Övrig/okänd';
}

/** Mellannivån för rader utan giltig sexsiffrig AID-kod (Utforska tappar dem annars). */
const OKAND_AID_KOD = 'Okänd AID-kod';

/** Gruppnyckel för en rad i en dimension. null = raden saknar värde där. */
export function groupKey(row, dim) {
    if (dim === 'bas') return row.bas || '—';
    if (dim === 'aid') {
        if (!row.aid) return row.yrke || '—';
        return row.yrkeLabel && row.yrkeLabel !== row.aid ? `${row.aid} ${row.yrkeLabel}` : String(row.aid);
    }
    if (dim === 'alder') return ageBucket(row.alder);
    if (dim === 'kon') return konOf(row);
    if (dim === 'alla') return 'Hela urvalet';
    // Samma grupper som gruppdossiern och lönekartläggningen arbetar med.
    if (dim === 'aidbas') return `${groupKey(row, 'aid')} · BAS ${row.bas || '—'}`;
    if (dim === 'lonespann') return _lonespann(row.lon);
    // AID-hierarkin (ADR-33): sektor = huvudområde, aidniva = fyra första siffrorna.
    if (dim === 'sektor') return sektorsnamn(row.aid);
    if (dim === 'aidniva') return mellannivaEtikett(row.aid) ?? OKAND_AID_KOD;
    return null;
}

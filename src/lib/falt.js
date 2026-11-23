// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Öppen lönekartläggning — Fältåtkomst för lönerader
 *
 * Gemensamma nycklar för hur en rad grupperas och jämförs: åldersgrupp,
 * normaliserat kön och gruppnyckel per dimension. Används av src/lib/utforska.js
 * (gruppering) och src/lib/urval.js (villkor), som inte får importera varandra.
 */
import { sektorsnamn, mellannivaEtikett, aidAvRad, namnrader } from './aid.js';
import { STANDARDTERMER as T, stor, adjektiv } from './termer.js';
import { arKvinna, arMan } from './kon.js';


const ALDERSORDNING = ['<20', '20–24', '25–29', '30–34', '35–39', '40–44', '45–49',
                   '50–54', '55–59', '60–64', '65+'];

/** Ålder → 5-årsgrupp. Under 20 och från 65 får egna grupper. */
export function aldersgrupp(alder) {
    const n = Number(alder);
    if (alder == null || !isFinite(n) || n <= 0) return null;
    if (n >= 65) return '65+';
    if (n < 20) return '<20';
    const lo = 20 + Math.floor((n - 20) / 5) * 5;
    return `${lo}–${lo + 4}`;
}

/** Sorteringsfunktion för åldersgrupper: yngst först. */
export function jamforAldersgrupp(a, b) {
    return ALDERSORDNING.indexOf(a) - ALDERSORDNING.indexOf(b);
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
export function konAv(rad) {
    if (arKvinna(rad)) return 'Kvinna';
    if (arMan(rad)) return 'Man';
    return 'Övrig/okänd';
}

/** Mellannivån för rader utan giltig sexsiffrig AID-kod (Utforska tappar dem annars). */
const OKAND_AID_KOD = `${stor(adjektiv('okänd', T.kod))} ${T.kod.en}`;

/** Gruppnyckel för en rad i en dimension. null = raden saknar värde där. */
export function gruppnyckel(rad, dim) {
    if (dim === 'bas') return rad.bas || '—';
    if (dim === 'aid') {
        if (!rad.aid) return rad.yrke || '—';
        return rad.yrkeLabel && rad.yrkeLabel !== rad.aid ? `${rad.aid} ${rad.yrkeLabel}` : String(rad.aid);
    }
    if (dim === 'alder') return aldersgrupp(rad.alder);
    if (dim === 'kon') return konAv(rad);
    if (dim === 'alla') return 'Hela urvalet';
    // Samma grupper som gruppdossiern och lönekartläggningen arbetar med.
    if (dim === 'aidbas') return `${gruppnyckel(rad, 'aid')} · BAS ${rad.bas || '—'}`;
    if (dim === 'lonespann') return _lonespann(rad.lon);
    // AID-hierarkin (ADR-33): sektor = huvudområde, aidniva = fyra första siffrorna.
    if (dim === 'sektor') return sektorsnamn(rad.aid);
    if (dim === 'aidniva') return mellannivaEtikett(rad.aid) ?? OKAND_AID_KOD;
    return null;
}

/**
 * Gruppnycklarna för ett underlag: som gruppnyckel, men dimensionerna 'aid' och 'aidbas' grupperar på AID-koden
 * (aidAvRad), inte på texten i fältet för AID-etikett. Namnet är gruppnyckel(rad, 'aid') för texten som står på flest
 * rader (namnrader i aid.js): för 'aid' bland kodens rader i underlaget, för 'aidbas' bland kodens rader i
 * BAS-intervallet, så att 'aidbas' bär samma namn som gruppen i resten av verktyget. Två stavningar av samma etikett
 * blir alltså en grupp med ett namn. För ett underlag där varje kod har en enda text är nycklarna desamma som gruppnyckel ger.
 * @param {any[]} rader
 * @returns {(row: any, dim: string) => (string|null)}
 */
export function gruppnycklar(rader) {
    const gruppAv = r => `${aidAvRad(r)}\u0000${r.bas || '—'}`;
    const perKod = namnrader(rader, aidAvRad), perGrupp = namnrader(rader, gruppAv);
    const namnAv = (karta, nyckel, row) => { const r = karta.get(nyckel); return gruppnyckel(r ?? row, 'aid'); };
    return (row, dim) => {
        if (dim === 'aid') return namnAv(perKod, aidAvRad(row), row);
        if (dim === 'aidbas') return `${namnAv(perGrupp, gruppAv(row), row)} · BAS ${row.bas || '—'}`;
        return gruppnyckel(row, dim);
    };
}

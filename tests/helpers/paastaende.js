// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Varje test måste pröva något: ett test utan påstående (en slinga över en tom lista, ett villkor som aldrig blir
// sant) faller i stället för att vara grönt.
import { beforeEach, expect } from 'vitest';

beforeEach(() => { expect.hasAssertions(); });

/**
 * Listan som ett prov går igenom med sina påståenden, som en lista som inte får vara tom: en slinga över en tom lista
 * påstår ingenting, och hasAssertions ser det bara när provet inte har något annat påstående.
 * @template T
 * @param {Iterable<T>|ArrayLike<T>} lista
 * @returns {T[]}
 */
export function ickeTom(lista) {
    const ut = Array.from(lista);
    expect(ut.length, 'listan som provet går igenom är tom').toBeGreaterThan(0);
    return ut;
}

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Bygget fäller ett toppnivånamn i dist/app.js som heter som en egenskap på window (tools/build-app.mjs).
 */
import { describe, it, expect } from 'vitest';
import { krockarMedWindow } from '../tools/build-app.mjs';

describe('vakten mot krock med window', () => {
    it('fäller var, function och class som heter som en egenskap på window, i jsdom och i den fasta listan', () => {
        expect(krockarMedWindow('var origin = 1; function close() {} class Node {} function chrome() {} var scheduler;'))
            .toEqual(['Node', 'chrome', 'close', 'origin', 'scheduler']);
    });
    it('släpper appens egna namn och namn i en funktion', () => {
        expect(krockarMedWindow('var state = {}; function ritaLikaArbete() { var close = 1; return close; }')).toEqual([]);
    });
});

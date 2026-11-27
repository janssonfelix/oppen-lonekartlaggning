// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Bygget fäller ett toppnivånamn i dist/app.js som heter som en egenskap på window (tools/build-app.mjs).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { krockarMedWindow, byggApp } from '../tools/build-app.mjs';

describe('vakten mot krock med window', () => {
    it('fäller var, function och class som heter som en egenskap på window, i jsdom och i den fasta listan', () => {
        expect(krockarMedWindow('var origin = 1; function close() {} class Node {} function chrome() {} var scheduler;'))
            .toEqual(['Node', 'chrome', 'close', 'origin', 'scheduler']);
    });
    it('fäller de inbäddade bibliotekens namn, som en del annars skulle skugga', () => {
        expect(krockarMedWindow('var d3; function Papa() {} var XLSX, JSZip;')).toEqual(['JSZip', 'Papa', 'XLSX', 'd3']);
    });
    it('släpper appens egna namn och namn i en funktion', () => {
        expect(krockarMedWindow('var state = {}; function ritaLikaArbete() { var close = 1; return close; }')).toEqual([]);
    });
});

describe('reproducerbart bygge (ADR-101)', () => {
    afterEach(() => { vi.useRealTimers(); });
    it('två byggen i samma process, med klockan på olika år, ger samma bytes', () => {
        vi.useFakeTimers({ now: new Date('2001-02-03T04:05:06Z'), toFake: ['Date'] });
        const forsta = byggApp();
        vi.setSystemTime(new Date('2039-12-31T23:59:59Z'));
        const andra = byggApp();
        expect(andra.length).toBeGreaterThan(100000);
        expect(andra === forsta).toBe(true);
    });
});

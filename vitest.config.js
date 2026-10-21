// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Gemensam tidsgräns och antal arbetare för testerna.
//
// Tidsgräns: många tester ritar hela verktyget i jsdom och tar 2–4 s var för sig; när alla filer körs parallellt
// föll olika tester på standardgränsen 5 s från körning till körning, utan att något var fel. En längre gräns tar
// bort den slumpen; ett test som hänger sig fälls fortfarande.
//
// Arbetare: Vitest kör en fil per arbetare, så den längsta filen sätter golvet för hela körningen (därför är
// röktestet, k-tröskeltestet, gränssnittstestet och diagramvyerna delade i filer per område, se teknisk-plan.md
// §6). Antalet arbetare är tre fjärdedelar av antalet trådar: de tunga filerna är processorbundna (jsdom ritar
// alla flikar), så på en maskin med åtta kärnor och sexton trådar (SMT) mättes åtta arbetare till 168 s (de tunga
// filerna köar), femton (Vitests standard, trådar − 1) till 150–168 s (trådarna trängs om kärnorna och varje fil
// tar tre gånger så lång tid som ensam) och tolv till 130 s. Taket från minnet: 1,2 GB per arbetare, som den
// tyngsta filen håller sig under (tests/helpers/app-harness.js), plus 2 GB åt resten av systemet, räknat på det
// totala minnet (det lediga varierar från körning till körning och gav olika antal arbetare). På en maskin med få
// kärnor eller lite minne blir sviten långsammare, inte ofullständig.
import { availableParallelism, totalmem } from 'node:os';
import { defineConfig } from 'vitest/config';

const GB = 1024 ** 3;
const maxWorkers = Math.max(1, Math.min(Math.round(availableParallelism() * 0.75), Math.floor((totalmem() - 2 * GB) / (1.2 * GB))));

export default defineConfig({
    test: { testTimeout: 30000, hookTimeout: 60000, maxWorkers },
});

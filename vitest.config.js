// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Gemensam tidsgräns och antal arbetare för testerna, och sviten delad i två projekt.
//
// Projekten: «enhet» är testfilerna som prövar moduler, vakter och källtext utan att ladda verktyget (sekunder),
// «app» är filerna som ritar det byggda verktyget i jsdom (minuter). `npm test` kör bara «enhet»; `npm run test:full`
// kör båda, och det är den som körs i CI och före en pull request. Klassningen görs när konfigurationen laddas, så
// en ny testfil hamnar rätt utan att listas: en fil hör till «app» om källan nämner appriggen
// (tests/helpers/app-harness.js, någon av tests/helpers/*-rigg.js eller createAppWindow) eller importerar jsdom.
// Tidsgränserna och uteslutningen nedan ärvs av båda projekten (extends: true); antalet arbetare gäller hela
// körningen, oavsett hur många projekt som körs.
//
// Tidsgräns: många tester ritar hela verktyget i jsdom och tar 2–4 s var för sig; när alla filer körs parallellt
// föll olika tester på standardgränsen 5 s från körning till körning, utan att något var fel. En längre gräns tar
// bort den slumpen; ett test som hänger sig fälls fortfarande.
//
// Arbetare: Vitest kör en fil per arbetare, så den längsta filen sätter golvet för hela körningen (därför är
// röktestet, k-tröskeltestet, gränssnittstestet och diagramvyerna delade i filer per område, se
// docs/utveckling/bygge-och-test.md §5.3). Antalet arbetare är tre fjärdedelar av antalet trådar: de tunga filerna är processorbundna (jsdom ritar
// alla flikar), så på en maskin med åtta kärnor och sexton trådar (SMT) mättes åtta arbetare till 168 s (de tunga
// filerna köar), femton (Vitests standard, trådar − 1) till 150–168 s (trådarna trängs om kärnorna och varje fil
// tar tre gånger så lång tid som ensam) och tolv till 130 s. Taket från minnet: 1,2 GB per arbetare, som den
// tyngsta filen håller sig under (tests/helpers/app-harness.js), plus 2 GB åt resten av systemet, räknat på det
// totala minnet (det lediga varierar från körning till körning och gav olika antal arbetare). På en maskin med få
// kärnor eller lite minne blir sviten långsammare, inte ofullständig.
//
// Uteslutning: .claude/ kan rymma andra sessioners arbetskopior av hela repot (.claude/worktrees/); utan undantaget
// kör Vitest deras testfiler också, och sviten blir flera gånger så lång.
import { readdirSync, readFileSync } from 'node:fs';
import { availableParallelism, totalmem } from 'node:os';
import { configDefaults, defineConfig } from 'vitest/config';

const GB = 1024 ** 3;
const maxWorkers = Math.max(1, Math.min(Math.round(availableParallelism() * 0.75), Math.floor((totalmem() - 2 * GB) / (1.2 * GB))));

const LADDAR_APPEN = /app-harness|-rigg\.js|from ['"]jsdom['"]|createAppWindow/;
const testkatalog = new URL('./tests/', import.meta.url);
const testfiler = readdirSync(testkatalog).filter(f => f.endsWith('.test.js')).sort();
const appfiler = testfiler.filter(f => LADDAR_APPEN.test(readFileSync(new URL(f, testkatalog), 'utf8')));
const enhetsfiler = testfiler.filter(f => !appfiler.includes(f));
const sökvägar = filer => filer.map(f => `tests/${f}`);

export default defineConfig({
    test: {
        testTimeout: 30000,
        hookTimeout: 60000,
        maxWorkers,
        exclude: [...configDefaults.exclude, '.claude/**'],
        projects: [
            { extends: true, test: { name: 'enhet', include: sökvägar(enhetsfiler) } },
            { extends: true, test: { name: 'app', include: sökvägar(appfiler) } },
        ],
    },
});

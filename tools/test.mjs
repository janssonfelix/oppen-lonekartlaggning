// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Kör testsviten (vitest) och kör om de filer vars ARBETARE kraschade.
//
// Node 22 kraschar ibland i en testarbetare (SIGSEGV i V8:s skräpsamlare, ungefär en gång på femtio körningar av den
// tyngsta filen). Då rapporterar vitest «Worker exited unexpectedly …
// while running test file X» och filens tester körs aldrig — sviten ser nästan grön ut men är ofullständig.
// Skriptet kör om just de filerna, högst två gånger. Ett test som FALLER körs aldrig om: bara en arbetare som dog.
// Utgångskoden är 0 först när varje fil har rapporterat och inget test har fallit.
//
// Argumenten skickas vidare till vitest: `--project=enhet` ger den snabba körningen (`npm test`), inga argument
// hela sviten (`npm run test:full`), se vitest.config.js. Vid en omkörning följer argumenten med, och filen
// hittas i sitt projekt.
import { spawnSync } from 'node:child_process';

const extra = process.argv.slice(2);
const kor = filer => {
    const r = spawnSync('npx', ['vitest', 'run', ...extra, ...filer], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const ut = (r.stdout || '') + (r.stderr || '');
    process.stdout.write(ut);
    // Vitest färgar utdata i GitHub Actions; färgkoderna tas bort innan raderna läses.
    const ren = ut.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
    const kraschade = [...new Set([...ren.matchAll(/Worker exited unexpectedly[^\n]*while running test file (.+?\.test\.js)/g)].map(m => m[1]))];
    // Ett test som faller känns igen i sammanfattningen, och en felkod utan kraschad arbetare räknas också som fel,
    // så att en ändrad utdata aldrig kan göra en röd körning grön.
    const fallna = /Tests\s+\d+ failed|Test Files\s+\d+ failed/.test(ren) || (r.status !== 0 && kraschade.length === 0);
    return { kod: r.status, kraschade, fallna };
};

// Utgångskoden sätts i process.exitCode i stället för process.exit(): mot en rörledning (som i GitHub Actions)
// hinner Node annars inte skriva klart, och loggen slutar vid 64 KB — utan felmeddelandet och sammanfattningen.
const korSviten = () => {
    let svar = kor([]);
    let fallna = svar.fallna;
    for (let forsok = 1; svar.kraschade.length && forsok <= 2; forsok++) {
        console.log(`\n[test] Arbetaren kraschade i ${svar.kraschade.length} fil(er); kör om (försök ${forsok} av 2):\n  ${svar.kraschade.join('\n  ')}\n`);
        svar = kor(svar.kraschade);
        fallna = fallna || svar.fallna;
    }
    if (svar.kraschade.length) { console.error('\n[test] Arbetaren kraschade också vid omkörning — sviten är ofullständig.'); return 1; }
    return fallna ? 1 : 0;
};
process.exitCode = korSviten();

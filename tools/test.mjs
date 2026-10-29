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
// Vid en hel körning (inga argument) jämförs dessutom antalet tester med raden "Vitest — N tester i M filer" i
// docs/utveckling/teknisk-plan.md, så att dokumentet inte kan glida isär från sviten (filantalet vaktas av
// tests/dokumentation.test.js).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

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
    const antal = Number((/^\s*Tests\s+.*\((\d+)\)\s*$/m.exec(ren) || [])[1] || 0);
    return { kod: r.status, kraschade, fallna, antal };
};

// Utgångskoden sätts i process.exitCode i stället för process.exit(): mot en rörledning (som i GitHub Actions)
// hinner Node annars inte skriva klart, och loggen slutar vid 64 KB — utan felmeddelandet och sammanfattningen.
const korSviten = () => {
    let svar = kor([]);
    let fallna = svar.fallna;
    // Antalet tester: första körningens summa, plus omkörningarnas. En arbetare som kraschar efter att filen
    // rapporterat klart (under nedmonteringen) har redan räknats i första körningen; då får summan inte dubblas.
    // Båda tolkningarna prövas mot planens rad, så att en omkörning aldrig gör en grön körning röd.
    const forsta = svar.antal;
    let omkorda = 0;
    for (let forsok = 1; svar.kraschade.length && forsok <= 2; forsok++) {
        console.log(`\n[test] Arbetaren kraschade i ${svar.kraschade.length} fil(er); kör om (försök ${forsok} av 2):\n  ${svar.kraschade.join('\n  ')}\n`);
        svar = kor(svar.kraschade);
        fallna = fallna || svar.fallna;
        omkorda += svar.antal;
    }
    if (svar.kraschade.length) { console.error('\n[test] Arbetaren kraschade också vid omkörning — sviten är ofullständig.'); return 1; }
    if (!extra.length && !fallna) {
        const plan = readFileSync(new URL('../docs/utveckling/teknisk-plan.md', import.meta.url), 'utf8');
        const m = /Vitest — (\d+) tester i \d+ filer/.exec(plan);
        const antal = [forsta + omkorda, ...(omkorda ? [forsta] : [])];
        if (!m || !antal.includes(Number(m[1]))) {
            console.error(`\n[test] teknisk-plan.md §6 säger ${m ? m[1] : '(ingen rad)'} tester, men sviten har ${antal.join(' eller ')}. Rätta raden "Vitest — N tester i M filer".`);
            return 1;
        }
    }
    return fallna ? 1 : 0;
};
process.exitCode = korSviten();

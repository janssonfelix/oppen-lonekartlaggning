// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Valideringsrapporten: varje krav i spårbarhetsmatrisen, prövat mot ett bygge.
//
//   npm run valideringsrapport                 kör hela testsviten (tools/test.mjs) och bygger rapporten
//   node tools/valideringsrapport.mjs <fil>    bygger rapporten ur en färdig körning (Vitests JSON-rapport)
//
// Rapporten (dist/valideringsrapport.md och .json) anger byggets version och SHA-256 (ur dist/RELEASE.txt, prövad mot
// filen), commit, datum, Node, Vitest och jsdom, och en rad per ID i docs/utveckling/sparbarhet.md: påståendet,
// funktion och fil, testerna vars namn bär ID:t och utfallet (godkänd, underkänd, saknas). Skriptet fäller (slutkod 1)
// när ett ID saknar godkänt test, när ett test bär ID:t och faller, när något test i sviten faller eller när
// kontrollsumman inte stämmer. Release-arbetsflödet kör det och signerar rapporten med de andra filerna (ADR-100).
//
// Rapporten innehåller bara testnamn, sökvägar i repot och versioner: inga lönedata och inga personuppgifter.
// Felmeddelandena ur testerna tas inte med.

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @typedef {Record<string, string>} Matrisrad  kolumnnamn → cellens text
 * @typedef {{ ancestorTitles: string[], title: string, fullName: string, status: string }} Testutfall
 * @typedef {{ name: string, status: string, assertionResults: Testutfall[] }} Testfil
 * @typedef {{ testResults: Testfil[] }} Vitestresultat
 * @typedef {{ fil: string, namn: string, utfall: string }} Test
 * @typedef {{ id: string, pastaende: string, funktionOchFil: string, tester: Test[], utfall: 'godkänd' | 'underkänd' | 'saknas' }} Rad
 */

/**
 * Matrisens rader: varje tabell vars första kolumn heter ID. Delas med vakten tests/sparbarhet.test.js.
 * @param {string} text sparbarhet.md
 * @returns {Matrisrad[]}
 */
export function lasMatris(text) {
    const celler = rad => rad.trim().replace(/^\||\|$/g, '').split(' | ').map(c => c.trim());
    /** @type {Matrisrad[]} */
    const rader = [];
    /** @type {string[] | null} */
    let rubrik = null;
    for (const rad of text.split('\n')) {
        if (!rad.startsWith('|')) { rubrik = null; continue; }
        if (/^[|: -]+$/.test(rad)) continue;   // avgränsaren under rubrikraden
        const c = celler(rad);
        if (c[0] === 'ID') { rubrik = c; continue; }
        if (!rubrik) continue;
        rader.push(Object.fromEntries(rubrik.map((namn, i) => [namn, c[i] ?? ''])));
    }
    return rader;
}

/**
 * ID:n först i en rubrik (`[B9.2] [B9.3] …` ger B9.2 och B9.3), som sparbarhet.md föreskriver.
 * @param {string} rubrik namnet på en describe eller ett test
 * @returns {string[]}
 */
export const idIRubrik = rubrik => [...(/^(?:\[[^\]\s]+\] ?)+/.exec(rubrik)?.[0] ?? '').matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);

/**
 * Prövar matrisen mot en körning.
 * @param {Matrisrad[]} matris
 * @param {Vitestresultat} resultat  Vitests JSON-rapport (filerna redan sammanslagna)
 * @param {string} root  repots rot, för relativa sökvägar
 */
export function bedom(matris, resultat, root = ROOT) {
    /** @type {Map<string, Test[]>} */
    const perId = new Map(matris.map(r => [r.ID, []]));
    const sviten = { filer: resultat.testResults.length, tester: 0, godkanda: 0, underkanda: 0, ovriga: 0, fallnaFiler: 0 };
    for (const f of resultat.testResults) {
        const fil = relative(root, f.name).split('\\').join('/');
        if (f.status === 'failed' && !f.assertionResults.some(t => t.status === 'failed')) sviten.fallnaFiler++;
        for (const t of f.assertionResults) {
            sviten.tester++;
            if (t.status === 'passed') sviten.godkanda++;
            else if (t.status === 'failed') sviten.underkanda++;
            else sviten.ovriga++;
            const ider = new Set([...t.ancestorTitles, t.title].flatMap(idIRubrik));
            for (const id of ider) perId.get(id)?.push({ fil, namn: t.fullName, utfall: t.status });
        }
    }
    /** @type {Rad[]} */
    const rader = matris.map(r => {
        const tester = perId.get(r.ID) ?? [];
        const utfall = tester.some(t => t.utfall === 'failed') ? 'underkänd'
            : tester.some(t => t.utfall === 'passed') ? 'godkänd' : 'saknas';
        return { id: r.ID, pastaende: r['Vad som räknas'] ?? r['Påstående'] ?? '', funktionOchFil: r['Funktion och fil'] ?? '', tester, utfall };
    });
    const antal = u => rader.filter(r => r.utfall === u).length;
    const summering = { id: rader.length, godkanda: antal('godkänd'), underkanda: antal('underkänd'), saknade: antal('saknas') };
    const godkand = summering.godkanda === rader.length && sviten.underkanda === 0 && sviten.fallnaFiler === 0;
    return { rader, summering, sviten, godkand };
}

/**
 * Vitests JSON-rapporter i ordning; en senare rapport ersätter en tidigare fil för fil (tools/test.mjs kör om en
 * fil vars arbetare kraschade och skriver omkörningen till en egen rapport).
 * @param {Vitestresultat[]} rapporter
 * @returns {Vitestresultat}
 */
export function slaSamman(rapporter) {
    const filer = new Map();
    for (const r of rapporter) for (const f of r.testResults) filer.set(f.name, f);
    return { testResults: [...filer.values()] };
}

/**
 * Rapporten som Markdown.
 * @param {ReturnType<typeof bedom> & { bygge: Record<string, string> }} r
 */
export function markdown(r) {
    const b = r.bygge;
    const s = r.summering;
    const filer = (/** @type {Test[]} */ t) => [...new Set(t.map(x => x.fil))]
        .map(f => `\`${f}\` (${t.filter(x => x.fil === f).length})`).join(', ') || '–';
    return [
        '# Valideringsrapport',
        '',
        `**${r.godkand ? 'Godkänd' : 'UNDERKÄND'}.** ${s.godkanda} av ${s.id} ID i spårbarhetsmatrisen har godkända tester` +
            ` (${s.underkanda} underkända, ${s.saknade} saknas). Hela sviten: ${r.sviten.tester} tester i ${r.sviten.filer} filer,` +
            ` ${r.sviten.godkanda} godkända, ${r.sviten.underkanda} underkända, ${r.sviten.ovriga} hoppade över` +
            (r.sviten.fallnaFiler ? `, ${r.sviten.fallnaFiler} filer kunde inte köras` : '') + '.',
        '',
        '| Uppgift | Värde |',
        '|---|---|',
        `| Version | ${b.version} |`,
        `| Fil | \`oppen-lonekartlaggning.html\` |`,
        `| SHA-256 | \`${b.sha256}\` |`,
        `| Commit | \`${b.commit}\`${b.ejIncheckat ? ' (med ändringar som inte är incheckade)' : ''} |`,
        `| Datum | ${b.datum} |`,
        `| Node | ${b.node} |`,
        `| Vitest | ${b.vitest} |`,
        `| Webbläsarmiljö | jsdom ${b.jsdom} |`,
        `| Operativsystem | ${b.os} |`,
        '',
        'Matrisen och vad varje ID betyder står i `docs/utveckling/sparbarhet.md`. Ett ID är godkänt när minst ett test',
        'vars namn bär ID:t gick igenom och inget föll. Testnamnen står i `valideringsrapport.json`. Röktestet i riktiga',
        'webbläsare körs i CI och ingår inte här.',
        '',
        '| ID | Påstående | Funktion och fil | Tester | Utfall |',
        '|---|---|---|---|---|',
        ...r.rader.map(x => `| ${x.id} | ${x.pastaende} | ${x.funktionOchFil} | ${filer(x.tester)} | ${x.utfall} |`),
        '',
    ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const läs = f => readFileSync(join(ROOT, f), 'utf8');
    const git = args => { try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } };
    const version = f => JSON.parse(läs(`node_modules/${f}/package.json`)).version;

    let rapporter;
    let sviteFoll = false;
    if (process.argv[2]) {
        rapporter = process.argv.slice(2).map(f => JSON.parse(readFileSync(f, 'utf8')));
    } else {
        const katalog = mkdtempSync(join(tmpdir(), 'valideringsrapport-'));
        const fil = join(katalog, 'vitest.json');
        const r = spawnSync(process.execPath, ['tools/test.mjs', '--reporter=default', '--reporter=json', `--outputFile.json=${fil}`],
            { cwd: ROOT, stdio: 'inherit' });
        sviteFoll = r.status !== 0;
        rapporter = [fil, fil.replace(/\.json$/, '.omkorning1.json'), fil.replace(/\.json$/, '.omkorning2.json')]
            .filter(f => existsSync(f)).map(f => JSON.parse(readFileSync(f, 'utf8')));
        rmSync(katalog, { recursive: true, force: true });
    }

    const release = läs('dist/RELEASE.txt');
    const sha256 = /SHA-256:\s+([0-9a-f]{64})/.exec(release)?.[1] ?? '';
    const filSha = createHash('sha256').update(readFileSync(join(ROOT, 'dist/oppen-lonekartlaggning.html'))).digest('hex');
    const rapport = {
        bygge: {
            version: /Version:\s+(\S+)/.exec(release)?.[1] ?? '',
            sha256,
            commit: git(['rev-parse', 'HEAD']),
            ejIncheckat: git(['status', '--porcelain']) ? 'ja' : '',
            datum: new Date().toISOString(),
            node: process.version,
            vitest: version('vitest'),
            jsdom: version('jsdom'),
            os: `${process.platform} ${process.arch}`,
        },
        ...bedom(lasMatris(läs('docs/utveckling/sparbarhet.md')), slaSamman(rapporter)),
    };
    const fel = [];
    if (sha256 !== filSha) fel.push(`dist/RELEASE.txt anger SHA-256 ${sha256 || '(ingen)'}, filen har ${filSha}. Kör npm run bundle.`);
    if (sviteFoll) fel.push('Testsviten föll (se utdata ovan).');
    for (const r of rapport.rader.filter(r => r.utfall !== 'godkänd')) fel.push(`${r.id}: ${r.utfall}`);
    if (rapport.sviten.underkanda || rapport.sviten.fallnaFiler) {
        fel.push(`${rapport.sviten.underkanda} tester föll och ${rapport.sviten.fallnaFiler} filer kunde inte köras.`);
    }
    if (fel.length) rapport.godkand = false;

    writeFileSync(join(ROOT, 'dist/valideringsrapport.json'), JSON.stringify(rapport, null, 2) + '\n');
    writeFileSync(join(ROOT, 'dist/valideringsrapport.md'), markdown(rapport));
    const s = rapport.summering;
    console.log(`\nValideringsrapport: ${s.godkanda} av ${s.id} ID godkända, ${s.underkanda} underkända, ${s.saknade} saknas`
        + ` -> dist/valideringsrapport.md, dist/valideringsrapport.json`);
    if (fel.length) {
        console.error('✗ Valideringen gick inte igenom:');
        for (const f of fel) console.error(`  - ${f}`);
        process.exitCode = 1;
    }
}

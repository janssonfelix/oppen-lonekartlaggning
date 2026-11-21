// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Linten: ESLint på den hopslagna appen, src/lib, tests och tools, med fel angivna i källfilerna.
//
//     node tools/lint.mjs          (npm run lint)
//     node tools/lint.mjs --fix    (npm run lint:fix)
//
// Appen lintas hopslagen, som buildAppBuffer() bygger den, så att linten ser globaler som ingen fil använder och
// namn som ingen fil deklarerar. Texten tas i minnet, så att linten granskar källan som den är också när
// dist/app.js inte är ombyggd. Varje rad och varje rättning översätts till rätt src/app/NN-*.js; --fix skriver
// rättningarna i källfilerna, aldrig i dist/app.js (som skrivs över vid nästa bygge).
import { ESLint } from 'eslint';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildAppBuffer } from './build-app.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOM = '\uFEFF';
// ESLints radbrytningar (lineBreakPattern i ESLint): CRLF räknas som en, ensam CR och LF som en var.
const RADBRYT = /\r\n|[\r\n\u2028\u2029]/g;

function radstarter(text) {
    const starter = [0];
    for (const m of text.matchAll(RADBRYT)) starter.push(m.index + m[0].length);
    return starter;
}

function sistaHogst(lista, varde) {
    let lo = 0, hi = lista.length - 1;
    while (lo < hi) {
        const mitt = (lo + hi + 1) >> 1;
        if (lista[mitt] <= varde) lo = mitt; else hi = mitt - 1;
    }
    return lo;
}

/**
 * Karta från den hopslagna texten till delarna. ESLint räknar utan en BOM först i texten (SourceCode tar bort den),
 * så tecknen i den hopslagna texten räknas efter en ev. inledande BOM. En BOM först i en senare del står kvar i
 * texten men räknas inte i delens egna kolumner, som när filen lintas ensam.
 * @param {{ fil: string, text: string }[]} delar
 */
export function appKarta(delar) {
    const forsta = delar.length && delar[0].text.startsWith(BOM) ? 1 : 0;
    let pos = -forsta;
    const info = delar.map(d => {
        const bom = d.text.startsWith(BOM) ? 1 : 0;
        const del = { fil: d.fil, start: pos, slut: pos + d.text.length, bom, starter: radstarter(d.text.slice(bom)) };
        pos = del.slut;
        return del;
    });
    const hela = radstarter(delar.map(d => d.text).join('').slice(forsta));
    const starter = info.map(d => d.start);
    const delVid = tecken => info[sistaHogst(starter, tecken)];

    return {
        /** Rad och kolumn (från 1) i den hopslagna texten → fil, rad och kolumn. */
        plats(rad, kolumn) {
            const tecken = hela[rad - 1] + kolumn - 1;
            const del = delVid(tecken);
            const lokal = Math.max(0, tecken - del.start - del.bom);
            const r = sistaHogst(del.starter, lokal);
            return { fil: del.fil, rad: r + 1, kolumn: lokal - del.starter[r] + 1 };
        },
        /** Ett intervall [från, till) i den hopslagna texten → fil och intervall i filens text (med en ev. BOM), eller null om det korsar en filgräns. */
        intervall([fran, till]) {
            const del = delVid(fran);
            if (till > del.slut) return null;
            return { fil: del.fil, intervall: [fran - del.start, till - del.start] };
        }
    };
}

function appDelar() {
    const { files, delar } = buildAppBuffer();
    return delar.map((b, i) => ({ fil: join('src', 'app', files[i]), text: b.toString('utf8') }));
}

function summera(filePath, messages) {
    const fel = messages.filter(m => m.fatal || m.severity === 2);
    const varningar = messages.filter(m => !fel.includes(m));
    return {
        filePath, messages, suppressedMessages: [],
        errorCount: fel.length, warningCount: varningar.length,
        fixableErrorCount: fel.filter(m => m.fix).length, fixableWarningCount: varningar.filter(m => m.fix).length,
        fatalErrorCount: messages.filter(m => m.fatal).length, usedDeprecatedRules: []
    };
}

/** Meddelandena för den hopslagna appen, fördelade på källfilerna. */
function oversattResultat(resultat, delar) {
    const karta = appKarta(delar);
    const perFil = new Map();
    for (const m of resultat.messages) {
        let fil = 'dist/app.js', ny = { ...m };
        if (m.line) {
            const start = karta.plats(m.line, m.column || 1);
            fil = start.fil;
            ny = { ...m, line: start.rad, column: start.kolumn };
            delete ny.endLine; delete ny.endColumn;
            if (m.endLine) {
                const slut = karta.plats(m.endLine, m.endColumn || 1);
                if (slut.fil === fil) Object.assign(ny, { endLine: slut.rad, endColumn: slut.kolumn });
            }
        }
        if (!perFil.has(fil)) perFil.set(fil, []);
        perFil.get(fil).push(ny);
    }
    return [...perFil].map(([fil, messages]) => summera(join(root, fil), messages));
}

/** Ett varv rättningar i källfilerna, bakifrån; som ESLint hoppas överlappande rättningar över till nästa varv. */
function rattaKallfiler(messages, delar) {
    const karta = appKarta(delar);
    const perFil = new Map();
    let senast = -1, antal = 0;
    for (const m of messages.filter(m => m.fix).sort((a, b) => a.fix.range[0] - b.fix.range[0])) {
        if (m.fix.range[0] < senast) continue;
        const mal = karta.intervall(m.fix.range);
        if (!mal) {
            const p = karta.plats(m.line, m.column);
            console.log(`lint: rättningen för ${m.ruleId} i ${p.fil}:${p.rad} korsar en filgräns och görs inte.`);
            continue;
        }
        senast = m.fix.range[1];
        if (!perFil.has(mal.fil)) perFil.set(mal.fil, []);
        perFil.get(mal.fil).push({ intervall: mal.intervall, text: m.fix.text });
    }
    for (const [fil, fixar] of perFil) {
        let text = readFileSync(join(root, fil), 'utf8');
        for (const { intervall: [a, b], text: t } of fixar.reverse()) text = text.slice(0, a) + t + text.slice(b);
        writeFileSync(join(root, fil), text);
        antal += fixar.length;
    }
    return antal;
}

async function main() {
    const fix = process.argv.includes('--fix');
    const ovriga = await new ESLint({ cwd: root, fix }).lintFiles(['src/lib', 'tests', 'tools']);
    if (fix) await ESLint.outputFixes(ovriga);

    const eslint = new ESLint({ cwd: root });
    let delar, app, rattade = 0;
    // Som ESLint: högst tio varv, eftersom en rättning kan ge plats för en annan.
    for (let varv = 0; varv < 10; varv++) {
        delar = appDelar();
        [app] = await eslint.lintText(delar.map(d => d.text).join(''), { filePath: 'dist/app.js' });
        if (!fix) break;
        const n = rattaKallfiler(app.messages, delar);
        if (!n) break;
        rattade += n;
    }

    const resultat = [...oversattResultat(app, delar), ...ovriga];
    const utdata = (await eslint.loadFormatter('stylish')).format(resultat);
    if (utdata) console.log(utdata);
    if (rattade) console.log(`lint: ${rattade} rättningar skrevs i src/app/. Kör npm run build:app.`);
    process.exitCode = resultat.some(r => r.errorCount > 0) ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();

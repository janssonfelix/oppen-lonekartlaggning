// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Bygg dist/app.js ur ES-modulerna i src/app/ med esbuild.
//
// dist/app.js är GENERERAD. Redigera ALDRIG den direkt — ändra rätt src/app/NN-*.js (eller src/lib/) och kör:
//     node tools/build-app.mjs      (eller: npm run build:app)
//
// Ingången är src/app/index.js, som importerar delarna i sifferordning. esbuild slår ihop dem och de lib-moduler de
// importerar till en platt fil utan import och export (format esm, ingen tree shaking, ingen minifiering), som körs
// som ett klassiskt skript: appens toppnivånamn blir globala, som testerna, röktestet och sidan läser dem. Bygget
// fäller om utfilen har import eller export kvar, eller om esbuild har döpt om ett toppnivånamn (en krock mellan två
// moduler ger `namn2`). Bygget är deterministiskt; artefaktgrinden (tools/kontroll.mjs och .github/workflows/ci.yml)
// bygger om och kräver samma fil.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildSync } from 'esbuild';
import * as espree from 'espree';
import * as eslintScope from 'eslint-scope';
import { writeVersionModule } from './gen-version.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ingang = join(root, 'src', 'app', 'index.js');

/**
 * Toppnivånamnen i en modul eller ett skript: de deklarerade och, för en modul, de importerade under eget namn.
 * @param {string} text
 * @param {'module'|'script'} sourceType
 * @returns {{ deklarerade: string[], importerade: string[], ovriga: string[], harImport: boolean }}
 */
function toppnivanamn(text, sourceType) {
    const ast = espree.parse(text, { ecmaVersion: 'latest', sourceType, range: true });
    const scope = eslintScope.analyze(/** @type {any} */ (ast), { ecmaVersion: 2022, sourceType });
    const topp = /** @type {import('eslint-scope').Scope} */ (sourceType === 'module' ? scope.globalScope?.childScopes[0] : scope.globalScope);
    const importerade = topp.variables.filter(v => v.defs.some(d => d.type === 'ImportBinding'
        && (d.node.type !== 'ImportSpecifier' || (d.node.imported.type === 'Identifier' && d.node.imported.name === v.name))));
    const DEKL = ['ImportDeclaration', 'ExportNamedDeclaration', 'FunctionDeclaration', 'VariableDeclaration', 'ClassDeclaration'];
    return {
        ovriga: ast.body.filter(st => !DEKL.includes(st.type)).map(st => st.type),
        harImport: ast.body.some(st => st.type === 'ImportDeclaration'),
        deklarerade: topp.variables.filter(v => v.defs.some(d => d.type !== 'ImportBinding')).map(v => v.name),
        importerade: importerade.map(v => v.name)
    };
}

/**
 * Bygger appen och returnerar texten. Kastar om utfilen inte är ett platt skript där appens namn står kvar.
 *
 * Appens namn är toppnivånamnen i src/app/: de som delarna deklarerar och de som de importerar ur src/lib/ under
 * lib-namnet. Vart och ett ska deklareras i en enda modul i bygget och stå oförändrat i utfilen; annars har esbuild
 * döpt om det (`namn2`) eller utelämnat modulen. Lib-modulernas egna namn som appen inte når (`T` i flera moduler)
 * får esbuild döpa om: de är privata i sin modul.
 * @returns {string}
 */
export function byggApp() {
    const r = buildSync({
        entryPoints: [ingang], bundle: true, format: 'esm', treeShaking: false, minify: false,
        charset: 'utf8', write: false, metafile: true, logLevel: 'silent'
    });
    const text = r.outputFiles[0].text;
    try {
        espree.parse(text, { ecmaVersion: 'latest', sourceType: 'script' });
    } catch (e) {
        throw new Error(`build-app: dist/app.js är inget klassiskt skript (import eller export kvar?): ${e.message}`);
    }
    const moduler = Object.keys(r.metafile.inputs).map(f => ({ f, ...toppnivanamn(readFileSync(join(root, f), 'utf8'), 'module') }));
    // Delarna deklarerar bara; det som körs vid laddning står i uppstartsfunktionerna, som index.js anropar i
    // sifferordning (ES-moduler körs i importgrafens ordning). 00 importerar inget och körs därför först.
    const delar = moduler.filter(m => /^src\/app\/\d\d-/.test(m.f));
    const laddning = delar.filter(m => !m.f.startsWith('src/app/00-') && m.ovriga.length).map(m => m.f);
    if (laddning.length) throw new Error(`build-app: kod utanför en deklaration (flytta den till delens uppstartsfunktion): ${laddning.join(', ')}`);
    if (delar.some(m => m.f.startsWith('src/app/00-') && m.harImport)) throw new Error('build-app: 00-sakerhet-och-uppstart.js ska inte importera något; den körs först.');
    const app = new Set(moduler.filter(m => m.f.startsWith('src/app/')).flatMap(m => [...m.deklarerade, ...m.importerade]));
    const antal = new Map();
    for (const n of moduler.flatMap(m => m.deklarerade)) antal.set(n, (antal.get(n) || 0) + 1);
    const ut = new Set(toppnivanamn(text, 'script').deklarerade);
    const fel = [...app].filter(n => antal.get(n) !== 1 || !ut.has(n)).sort();
    if (fel.length) {
        throw new Error('build-app: appens namn ska deklareras i en enda modul och stå oförändrade i dist/app.js:\n'
            + fel.map(n => `  ${n}: ${moduler.filter(m => m.deklarerade.includes(n)).map(m => m.f).join(', ') || 'ingen modul'}`
                + (ut.has(n) ? '' : ' (saknas i utfilen)')).join('\n'));
    }
    return text;
}

/** Skriver src/app/08-version.js och dist/app.js; returnerar antalet byte. */
export function skrivApp() {
    writeVersionModule();   // src/app/08-version.js från VERSION (enda källan)
    const text = byggApp();
    writeFileSync(join(root, 'dist', 'app.js'), text);
    return Buffer.byteLength(text);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    console.log(`build-app: dist/app.js (${skrivApp()} byte) ur src/app/index.js`);
}

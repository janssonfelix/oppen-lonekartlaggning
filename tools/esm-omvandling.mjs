// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Engångsomvandlingen av src/app/NN-*.js från klassiska skript till ES-moduler (ADR om esbuild-bygget).
//
//     node tools/esm-omvandling.mjs            visar vad som skulle ändras
//     node tools/esm-omvandling.mjs --skriv    skriver om delarna och src/app/index.js
//
// För varje del: `export` på toppnivådeklarationer som en annan del använder eller som delen själv inte använder
// (de når HTML, testerna och röktestet som globala namn), `import { … } from './NN-….js'` för fria namn som en
// annan del deklarerar, och spegelns alias (_stKonsMedianer m.fl.) bytta mot lib-namnet med en import ur
// src/lib/; krockar lib-namnet i delen behålls aliaset med `import { x as alias }`.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as espree from 'espree';
import * as eslintScope from 'eslint-scope';
import { MODULES } from './gen-mirrors.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appDir = join(root, 'src', 'app');
const SPEGEL = '09-lib-speglar.js';
const skriv = process.argv.includes('--skriv');
const uppstartSteg = process.argv.includes('--uppstart');
if (uppstartSteg) { uppstart(); process.exit(0); }

/** alias i appen → { fil, namn } i src/lib/ */
const alias = new Map();
for (const m of MODULES) for (const [namn, a] of Object.entries(m.expose)) if (a) alias.set(a, libExport(m.file, namn));

/** Var lib-namnet exporteras: modulen själv, eller modulen det importeras ur (`_median` i loneoversyn.js är stat.js `median`). */
function libExport(fil, namn) {
    const text = readFileSync(join(root, 'src', 'lib', fil), 'utf8');
    if (new RegExp(`^export\\s+(?:async\\s+)?(?:function\\*?|const|let|class)\\s+${namn.replace(/\$/g, '\\$')}\\b`, 'm').test(text)) return { fil, namn };
    for (const m of text.matchAll(/^import\s*\{([^}]*)\}\s*from\s*'\.\/([\w.-]+)';/gm)) {
        for (const bit of m[1].split(',')) {
            const [ex, lok = ex] = bit.trim().split(/\s+as\s+/);
            if (lok === namn) return libExport(m[2], ex);
        }
    }
    console.log(`! ${fil} exporterar inte ${namn}`); return { fil, namn };
}

/** Spegelns namnrymder: __mirrorStat → stat.js */
const namnrymd = new Map(MODULES.map(m => [m.ns, m.file]));

/** Lib-namn som flera lib-moduler exporterar (hantelRader): i den platta utfilen får bara ett behålla namnet. */
const flerdubbla = new Set([...alias.values()].map(v => v.namn)
    .filter(n => new Set([...alias.values()].filter(v => v.namn === n).map(v => v.fil)).size > 1));

const filer = readdirSync(appDir).filter(f => /^\d\d-.*\.js$/.test(f) && f !== SPEGEL).sort();
const delar = filer.map(fil => {
    const text = readFileSync(join(appDir, fil), 'utf8');
    const ast = espree.parse(text, { ecmaVersion: 2022, sourceType: 'script', range: true, loc: true });
    const scope = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
    const glob = scope.globalScope;
    /** namn → deklarationens toppnivåsats */
    const dekl = new Map();
    for (const v of glob.variables) {
        if (!v.defs.length) continue;
        const d = v.defs[0];
        let sats = d.type === 'FunctionName' || d.type === 'ClassName' ? d.node : d.parent;
        if (!ast.body.includes(sats)) { console.log(`! ${fil}: ${v.name} deklareras inte direkt på toppnivå`); sats = null; }
        if (v.defs.length > 1) console.log(`! ${fil}: ${v.name} deklareras ${v.defs.length} gånger`);
        dekl.set(v.name, sats);
    }
    /** Alla referenser till toppnivånamn eller fria namn: { ref, namn } */
    const refs = [];
    for (const s of scope.scopes) for (const r of s.references) {
        if (r.resolved && r.resolved.scope !== glob) continue;
        refs.push(r);
    }
    return { fil, text, ast, scope, glob, dekl, refs };
});

const deklareradI = new Map();
for (const d of delar) for (const n of d.dekl.keys()) {
    if (deklareradI.has(n)) console.log(`! ${n} deklareras i både ${deklareradI.get(n)} och ${d.fil}`);
    else deklareradI.set(n, d.fil);
}

/** Används namnet (som toppnivå-/fritt namn) i delen? */
const anvandI = new Map();
for (const d of delar) for (const r of d.refs) {
    const n = r.identifier.name;
    if (!anvandI.has(n)) anvandI.set(n, new Set());
    anvandI.get(n).add(d.fil);
}

/** Har något scope mellan referensen och toppnivån ett eget `namn`? */
function skuggas(r, namn) {
    for (let s = r.from; s && s.type !== 'global'; s = s.upper) if (s.set.has(namn)) return true;
    return false;
}

const rapport = { exporter: 0, delarMedImport: 0, delarMedExport: 0, krockar: [], skrivningar: [] };
for (const d of delar) {
    const importer = new Map(); // fil → Map(importnamn → lokalt namn)
    const byten = []; // [från, till, text]
    const lib = new Map(); // alias → { fil, namn }
    for (const r of d.refs) {
        const n = r.identifier.name;
        if (d.dekl.has(n)) continue;
        const fran = deklareradI.get(n);
        if (fran) {
            if (r.isWrite()) rapport.skrivningar.push(`${d.fil}:${r.identifier.loc.start.line} skriver ${n} (deklareras i ${fran})`);
            if (!importer.has(fran)) importer.set(fran, new Map());
            importer.get(fran).set(n, n);
        } else if (alias.has(n)) {
            if (r.isWrite()) rapport.skrivningar.push(`${d.fil}:${r.identifier.loc.start.line} skriver aliaset ${n}`);
            lib.set(n, alias.get(n));
        }
    }
    // Spegelns namnrymder (__mirrorStat.median) blir en import av lib-namnet.
    (function ga(n) {
        if (!n || typeof n.type !== 'string') return;
        if (n.type === 'MemberExpression' && !n.computed && n.object.type === 'Identifier' && namnrymd.has(n.object.name)) {
            const namn = n.property.name, fil = namnrymd.get(n.object.name);
            if (d.dekl.has(namn) || d.scope.scopes.some(s => s.set.has(namn))) throw new Error(`${d.fil}: ${namn} krockar`);
            const nyckel = '../lib/' + fil;
            if (!importer.has(nyckel)) importer.set(nyckel, new Map());
            importer.get(nyckel).set(namn, namn);
            byten.push([n.range[0], n.range[1], namn]);
            return;
        }
        for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(ga); else if (v && typeof v === 'object' && v.type) ga(v); }
    })(d.ast);
    // Aliasen: lib-namnet om det inte krockar i delen, annars `as`.
    const libNamnAnvant = new Map();
    for (const { namn } of lib.values()) libNamnAnvant.set(namn, (libNamnAnvant.get(namn) || 0) + 1);
    for (const [a, { fil, namn }] of lib) {
        const r2 = d.refs.filter(r => r.identifier.name === a);
        const krock = a !== namn && (d.dekl.has(namn) || deklareradI.has(namn) && anvandI.get(namn)?.has(d.fil)
            || (anvandI.get(namn)?.has(d.fil)) || libNamnAnvant.get(namn) > 1 || flerdubbla.has(namn) || r2.some(r => skuggas(r, namn))
            || d.scope.scopes.some(s => s.set.has(namn)));
        const nyckel = '../lib/' + fil;
        if (!importer.has(nyckel)) importer.set(nyckel, new Map());
        if (krock) {
            rapport.krockar.push(`${d.fil}: ${a} behålls (import { ${namn} as ${a} })`);
            importer.get(nyckel).set(`${namn} as ${a}`, a);
        } else {
            importer.get(nyckel).set(namn, namn);
            if (a !== namn) for (const r of r2) byten.push([r.identifier.range[0], r.identifier.range[1], namn]);
        }
    }
    // Exporter
    const exportSatser = new Set();
    for (const [n, sats] of d.dekl) {
        const andra = [...(anvandI.get(n) || [])].some(f => f !== d.fil);
        const egen = d.refs.some(r => r.identifier.name === n && r.resolved && r.resolved.scope === d.glob && !r.init);
        if ((andra || !egen) && sats) exportSatser.add(sats);
    }
    rapport.exporter += exportSatser.size;
    if (exportSatser.size) rapport.delarMedExport++;
    if (importer.size) rapport.delarMedImport++;
    for (const sats of exportSatser) byten.push([sats.range[0], sats.range[0], 'export ']);

    // Importraderna, efter sidhuvudets kommentarer
    const ordning = [...importer.keys()].sort((a, b) => (a.startsWith('../') ? 0 : 1) - (b.startsWith('../') ? 0 : 1) || a.localeCompare(b));
    const rader = ordning.map(k => `import { ${[...importer.get(k).keys()].sort((a, b) => a.localeCompare(b)).join(', ')} } from '${k.startsWith('../') ? k : './' + k}';`);
    let text = d.text;
    for (const [a, b, t] of byten.sort((x, y) => y[0] - x[0] || y[1] - x[1])) text = text.slice(0, a) + t + text.slice(b);
    if (rader.length) {
        const m = /^(?:\/\/[^\n]*\n)*/.exec(text);
        const pos = m ? m[0].length : 0;
        text = text.slice(0, pos) + rader.join('\n') + '\n' + text.slice(pos);
    }
    d.ny = text;
}

// Shorthand-kontroll: ett bytt alias i { alias } blir { libnamn } — fel nyckel.
for (const d of delar) {
    const sh = [];
    (function gå(n) {
        if (!n || typeof n.type !== 'string') return;
        if (n.type === 'Property' && n.shorthand && alias.has(n.key.name)) sh.push(`${d.fil}:${n.loc.start.line} { ${n.key.name} }`);
        for (const k of Object.keys(n)) { const v = n[k]; if (k === 'parent') continue; if (Array.isArray(v)) v.forEach(gå); else if (v && typeof v === 'object' && v.type) gå(v); }
    })(d.ast);
    if (sh.length) console.log('! shorthand med alias:', sh.join(', '));
}

console.log(`Delar: ${delar.length}, med import: ${rapport.delarMedImport}, med export: ${rapport.delarMedExport}, exporterade satser: ${rapport.exporter}`);
console.log(`Krockar (aliaset behålls): ${rapport.krockar.length}`);
for (const k of rapport.krockar) console.log('  ' + k);
console.log(`Skrivningar till importerade namn: ${rapport.skrivningar.length}`);
for (const s of rapport.skrivningar) console.log('  ' + s);

if (skriv) {
    for (const d of delar) writeFileSync(join(appDir, d.fil), d.ny);
    writeFileSync(join(appDir, 'index.js'), [
        '// SPDX-License-Identifier: MIT',
        '// Copyright 2026 Felix Jansson',
        '// Ingången för bygget (tools/build-app.mjs): delarna i sifferordning, för deras sidoeffekter.',
        ...filer.map(f => `import './${f}';`),
        ''
    ].join('\n'));
    console.log('Skrev delarna och src/app/index.js.');
    // Testerna och röktestet läser appens globala namn: aliasen byts mot lib-namnet, som står kvar i utfilen.
    // drift.test.js prövar spegeln och står kvar tills spegeln tas bort.
    const testfiler = [
        ...readdirSync(join(root, 'tests')).filter(f => f.endsWith('.js') && f !== 'drift.test.js').map(f => join('tests', f)),
        ...readdirSync(join(root, 'tests', 'helpers')).map(f => join('tests', 'helpers', f)),
        ...readdirSync(join(root, 'tools', 'browser-smoke')).map(f => join('tools', 'browser-smoke', f)),
        'tools/browser-smoke.mjs', 'tools/perf-smoke.mjs', 'eslint.config.js'
    ];
    for (const f of testfiler) {
        const fore = readFileSync(join(root, f), 'utf8');
        let text = fore;
        for (const [a, { namn }] of alias) {
            if (a === namn || flerdubbla.has(namn)) continue;
            text = text.replace(new RegExp(`(?<![\\w$])${a.replace(/\$/g, '\\$')}(?![\\w$])`, 'g'), namn);
        }
        if (text !== fore) { writeFileSync(join(root, f), text); console.log(`  alias → lib-namn i ${f}`); }
    }
}

/**
 * Steg två (--uppstart): koden som körs vid laddning flyttas ur delarnas toppnivå till en uppstartsfunktion per del
 * (uppstartFilinlasning m.fl.), som index.js anropar i sifferordning efter att alla delar har lästs. ES-modulerna körs i importgrafens
 * ordning, inte i sifferordning; deklarationerna tål det, men inte anrop som läser en annan dels tillstånd. Delen 00
 * står kvar: den importerar inget och körs först i utfilen.
 */
/** 32-filinlasning.js → uppstartFilinlasning; 90-uppstart.js → uppstartSist */
function uppstartNamn(fil) {
    const ord = fil.slice(3, -3).split('-');
    return fil.startsWith('90-') ? 'uppstartSist' : 'uppstart' + ord.map(o => o[0].toUpperCase() + o.slice(1)).join('');
}

function uppstart() {
    const DEKL = new Set(['ImportDeclaration', 'FunctionDeclaration', 'VariableDeclaration', 'ClassDeclaration', 'ExportNamedDeclaration']);
    const filer = readdirSync(appDir).filter(f => /^\d\d-.*\.js$/.test(f) && f !== SPEGEL).sort();
    const medUppstart = [];
    for (const fil of filer) {
        if (fil.startsWith('00-')) continue;
        const text = readFileSync(join(appDir, fil), 'utf8');
        const ast = espree.parse(text, { ecmaVersion: 2022, sourceType: 'module', range: true, comment: true });
        const satser = ast.body.filter(st => !DEKL.has(st.type));
        if (!satser.length) continue;
        const nr = uppstartNamn(fil);
        const mallar = [];
        (function ga(n) {
            if (!n || typeof n.type !== 'string') return;
            if (n.type === 'TemplateLiteral') mallar.push(n.range);
            for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(ga); else if (v && typeof v === 'object' && v.type) ga(v); }
        })(ast);
        // Varje sats med kommentarerna närmast ovanför (utan tom rad emellan) och kommentaren efter på samma rad.
        const bitar = satser.map(st => {
            let [a, b] = st.range;
            for (const c of [...ast.comments].reverse()) {
                if (c.range[1] <= a && /^[ \t]*\n?[ \t]*$/.test(text.slice(c.range[1], a)) && !/\n[ \t]*\n/.test(text.slice(c.range[1], a))) {
                    const radstart = text.lastIndexOf('\n', c.range[0] - 1) + 1;
                    if (/^[ \t]*$/.test(text.slice(radstart, c.range[0]))) a = c.range[0];
                }
            }
            const radslut = text.indexOf('\n', b);
            const efter = text.slice(b, radslut < 0 ? text.length : radslut);
            if (/^[ \t]*\/\//.test(efter)) b = radslut < 0 ? text.length : radslut;
            const radstart = text.lastIndexOf('\n', a - 1) + 1;
            if (/^[ \t]*$/.test(text.slice(radstart, a))) a = radstart;
            const slut = radslut >= 0 && b <= radslut ? radslut + 1 : b;
            return { a, b: slut, kropp: text.slice(a, b) };
        });
        // Indrag med fyra mellanslag, utom på rader som börjar inuti en mall (texten i mallen får inte ändras).
        const indrag = bit => {
            let ut = '';
            let pos = bit.a;
            for (const rad of bit.kropp.split('\n')) {
                const iMall = mallar.some(([x, y]) => pos > x && pos < y);
                ut += (rad && !iMall ? '    ' : '') + rad + '\n';
                pos += rad.length + 1;
            }
            return ut.replace(/\n$/, '');
        };
        let ny = text;
        for (const bit of [...bitar].reverse()) ny = ny.slice(0, bit.a) + ny.slice(bit.b);
        ny = ny.replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n');
        ny += `\n/** Det som körs vid laddning, i filens ordning; src/app/index.js anropar delarnas uppstart i sifferordning. */\n`
            + `export function ${nr}() {\n${bitar.map(indrag).join('\n')}\n}\n`;
        writeFileSync(join(appDir, fil), ny);
        medUppstart.push(fil);
        console.log(`${fil}: ${satser.length} satser till ${nr}()`);
    }
    const nrAv = uppstartNamn;
    writeFileSync(join(appDir, 'index.js'), [
        '// SPDX-License-Identifier: MIT',
        '// Copyright 2026 Felix Jansson',
        '// Ingången för bygget (tools/build-app.mjs). Delarna importeras i sifferordning; ES-moduler körs ändå i',
        '// importgrafens ordning, så delarna deklarerar bara (00 undantagen: den importerar inget och körs först). Det som',
        '// ska köras vid laddning står i delens uppstartsfunktion, och här anropas de i sifferordning.',
        ...filer.map(f => medUppstart.includes(f) ? `import { ${nrAv(f)} } from './${f}';` : `import './${f}';`),
        '',
        ...medUppstart.map(f => `${nrAv(f)}();`),
        ''
    ].join('\n'));
    console.log(`${medUppstart.length} delar fick en uppstartsfunktion; skrev src/app/index.js.`);
}

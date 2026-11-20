// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Vakt för src/lib/: modulerna är rena och ligger i ett eget lager. Testet läser källtexten och laddar ingen modul,
 * så det hör till projektet «enhet». Tre saker hålls sanna: importgrafen är fri från cykler, en modul importerar
 * bara andra filer i src/lib/, och ingen modul använder webbläsarens eller appens globaler (document, window,
 * localStorage, sessionStorage, navigator och appens state). Kommentarer och strängar tas bort före sökningen, så
 * att ord i dokumentationen inte fäller testet.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const LIB = join(import.meta.dirname, '..', 'src', 'lib');
const filer = readdirSync(LIB).filter(f => f.endsWith('.js')).sort();
const modulnamn = f => f.replace(/\.js$/, '');

/** Tar bort kommentarer och strängar (inklusive mallsträngar, men inte deras ${}-uttryck) så att bara kod återstår. */
function utanKommentarerOchStrangar(js) {
    return js.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`((?:\\.|\$\{[^}]*\}|[^`\\])*)`/g,
        (träff, mall) => {
            if (mall === undefined) return träff.startsWith('/') ? ' ' : ' ""';
            const uttryck = [...mall.matchAll(/\$\{([^}]*)\}/g)].map(m => m[1]).join(' ; ');
            return ' ' + uttryck + ' ';
        });
}

/** Modulens importer av andra filer: statiska import/export-from och dynamiska import(). */
function importer(js) {
    const kod = utanKommentarerOchStrangar(js);
    const sokvagar = [];
    for (const m of kod.matchAll(/\bimport\s+[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)) sokvagar.push(m[1]);
    for (const m of kod.matchAll(/\bexport\s+[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)) sokvagar.push(m[1]);
    if (/\bimport\s*\(/.test(kod)) sokvagar.push('(dynamisk import)');
    for (const m of kod.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) sokvagar.push(m[1]);
    return sokvagar;
}

/** Importgrafen: modulnamn → de lib-moduler den importerar. Importer utanför src/lib/ hamnar i grafen som de är. */
function importgraf(filnamn) {
    const graf = new Map();
    for (const f of filnamn) {
        const grannar = importer(readFileSync(join(LIB, f), 'utf8'))
            .filter(s => /^\.\/[\w-]+\.js$/.test(s))
            .map(s => modulnamn(s.slice(2)));
        graf.set(modulnamn(f), grannar);
    }
    return graf;
}

/** Första cykeln i grafen som en lista av namn, t.ex. ['a', 'b', 'c', 'a'], eller null om grafen är fri från cykler. */
function hittaCykel(graf) {
    const besokt = new Set();
    const stack = [];
    const pa = new Set();
    function gå(nod) {
        if (pa.has(nod)) return [...stack.slice(stack.indexOf(nod)), nod];
        if (besokt.has(nod)) return null;
        besokt.add(nod);
        pa.add(nod);
        stack.push(nod);
        for (const granne of graf.get(nod) || []) {
            const cykel = gå(granne);
            if (cykel) return cykel;
        }
        stack.pop();
        pa.delete(nod);
        return null;
    }
    for (const nod of graf.keys()) {
        const cykel = gå(nod);
        if (cykel) return cykel;
    }
    return null;
}

// En föregående punkt är egenskap (x.document), och ett kolon är XML-prefix (w:document i WordprocessingML).
const GLOBALER = /(?<![\w$.:])(document|window|localStorage|sessionStorage|navigator)\b/g;
// `state` är appens globala tillstånd. Ett fritt `state` (inte föregånget av punkt eller bokstav, och inte en
// egenskapsnyckel `state:`) är en överträdelse. Lokala variabler med samma namn undantas per fil nedan.
const STATE = /(?<![\w$.:])state\b(?!\s*:)/g;
const STATE_UNDANTAG = {};

describe('src/lib/ har en ren importgraf', () => {
    it('importgrafen mellan lib-modulerna har inga cykler', () => {
        const cykel = hittaCykel(importgraf(filer));
        expect(cykel, cykel ? `Cykel i importgrafen: ${cykel.join(' → ')}` : '').toBeNull();
    });

    it('ingen lib-modul importerar något utanför src/lib/ (bara relativa ./namn.js)', () => {
        const fynd = [];
        for (const f of filer) {
            for (const s of importer(readFileSync(join(LIB, f), 'utf8'))) {
                if (!/^\.\/[\w-]+\.js$/.test(s)) fynd.push(`${f}: ${s}`);
            }
        }
        expect(fynd).toEqual([]);
    });

    it('självtest: cykelsökningen hittar en cykel a → b → c → a', () => {
        const cykel = hittaCykel(new Map([['a', ['b']], ['b', ['c']], ['c', ['a']]]));
        expect(cykel).not.toBeNull();
        expect(cykel[0]).toBe(cykel[cykel.length - 1]);
        expect(new Set(cykel)).toEqual(new Set(['a', 'b', 'c']));
    });

    it('självtest: cykelsökningen hittar ingen cykel i en cykelfri graf', () => {
        expect(hittaCykel(new Map([['a', ['b', 'c']], ['b', ['c']], ['c', []]]))).toBeNull();
    });
});

describe('src/lib/ använder inga webbläsar- eller appglobaler', () => {
    it('självtest: sökningen fångar en global i kod men inte i kommentarer, strängar eller egenskaper', () => {
        const kod = utanKommentarerOchStrangar("const a = document.body; // window\nconst b = 'localStorage'; /* navigator */ const c = x.window;\nconst d = `${state.data} window`;");
        const träffar = [...kod.matchAll(GLOBALER)].map(m => m[1]);
        expect(träffar).toEqual(['document']);
        expect([...utanKommentarerOchStrangar('const d = `${state.data} window`;').matchAll(STATE)]).toHaveLength(1);
    });


    it('ingen lib-modul använder document, window, localStorage, sessionStorage eller navigator som fri variabel', () => {
        const fynd = [];
        for (const f of filer) {
            const kod = utanKommentarerOchStrangar(readFileSync(join(LIB, f), 'utf8'));
            for (const m of kod.matchAll(GLOBALER)) fynd.push(`${f}: ${m[1]}`);
        }
        expect(fynd).toEqual([]);
    });

    it('ingen lib-modul använder appens state som fri variabel (undantag enligt STATE_UNDANTAG)', () => {
        const fynd = [];
        for (const f of filer) {
            if (STATE_UNDANTAG[f]) continue;
            const kod = utanKommentarerOchStrangar(readFileSync(join(LIB, f), 'utf8'));
            if (STATE.test(kod)) fynd.push(f);
            STATE.lastIndex = 0;
        }
        expect(fynd).toEqual([]);
    });
});

// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
/**
 * Motorn i escaping-vakten (tests/escaping.test.js): en tokeniserare för appens JavaScript och reglerna som avgör om
 * ett värde som hamnar i HTML är säkert. Reglerna, och vad vakten inte täcker, står i testfilens huvud.
 *
 * granska(kallor, undantag) tar [{ namn, src, prova? }] och ger { resultat, fynd, oanvanda }: ett resultat per prövat
 * uttryck (typ, fil, rad, ok, regel), fynden (de uttryck längst in som inte gick att bevisa, med skälet) och de
 * undantagsposter som inte träffade något.
 */

// ---- Tokeniseraren ----
// Ger en platt lista: namn, tal, str (med värdet), regex, op och mall-delar (hel, huvud, mitt, svans), som i en
// riktig JavaScript-lexer. ${ och } runt ett uttryck i en mallsträng blir del av mallens delar.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PUNKT = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&',
    '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>'];
const FORE_UTTRYCK = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'instanceof']);
const ID_START = /[A-Za-z_$À-￿]/;
const ID_DEL = /[\w$À-￿]/;
const TAL = /0[xXbBoO][\da-fA-F_]+n?|(?:\d[\d_]*\.?\d*|\.\d+)(?:[eE][+-]?\d+)?n?/y;

function lexa(src) {
    const tok = [];
    const stack = [];
    let i = 0, nyRad = false;
    const push = (t, v, s, extra) => { tok.push({ t, v, s, e: i, nyRad, ...extra }); nyRad = false; };
    const regexTillaten = () => {
        const f = tok[tok.length - 1];
        if (!f) return true;
        if (f.t === 'namn') return FORE_UTTRYCK.has(f.v);
        if (f.t === 'op') return ![')', ']', '}'].includes(f.v);
        return f.t === 'mall' && (f.v === 'huvud' || f.v === 'mitt');
    };
    const lasMall = (s, forst) => {
        let text = '';
        while (i < src.length) {
            const c = src[i];
            if (c === '\\') { text += src.slice(i, i + 2); i += 2; continue; }
            if (c === '`') { i++; push('mall', forst ? 'hel' : 'svans', s, { text }); return; }
            if (c === '$' && src[i + 1] === '{') { i += 2; push('mall', forst ? 'huvud' : 'mitt', s, { text }); stack.push('mall'); return; }
            text += c; i++;
        }
        throw new Error(`oavslutad mallsträng vid ${s}`);
    };
    while (i < src.length) {
        const c = src[i];
        if (c === '\n') { nyRad = true; i++; continue; }
        if (c === ' ' || c === '\t' || c === '\r' || /\s/.test(c)) { i++; continue; }
        if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
        if (c === '/' && src[i + 1] === '*') { const j = src.indexOf('*/', i + 2); if (src.slice(i, j).includes('\n')) nyRad = true; i = j + 2; continue; }
        const s = i;
        if (ID_START.test(c)) { while (i < src.length && ID_DEL.test(src[i])) i++; push('namn', src.slice(s, i), s); continue; }
        if (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1]))) { TAL.lastIndex = i; const m = TAL.exec(src); i += m ? m[0].length : 1; push('tal', src.slice(s, i), s); continue; }
        if (c === '"' || c === "'") {
            i++; let v = '';
            while (src[i] !== c) { if (i >= src.length) throw new Error(`oavslutad sträng vid ${s}`); if (src[i] === '\\') { v += src[i + 1]; i += 2; } else v += src[i++]; }
            i++; push('str', v, s); continue;
        }
        if (c === '`') { i++; lasMall(s, true); continue; }
        if (c === '}' && stack[stack.length - 1] === 'mall') { stack.pop(); i++; lasMall(s, false); continue; }
        if (c === '/' && regexTillaten()) {
            i++; let iKlass = false;
            for (;;) {
                const d = src[i];
                if (d === undefined || d === '\n') throw new Error(`oavslutat reguljärt uttryck vid ${s}`);
                if (d === '\\') { i += 2; continue; }
                if (d === '[') iKlass = true; else if (d === ']') iKlass = false; else if (d === '/' && !iKlass) break;
                i++;
            }
            i++; while (i < src.length && ID_DEL.test(src[i])) i++;
            push('regex', src.slice(s, i), s); continue;
        }
        if (c === '{') stack.push('{');
        if (c === '}') stack.pop();
        const p = PUNKT.find(q => src.startsWith(q, i) && !(q === '?.' && /\d/.test(src[i + 2])));
        i += p ? p.length : 1;
        push('op', p || c, s);
    }
    return tok;
}

// ---- Strukturen: par av klamrar, block, funktioner, deklarationer ----

const OPPNA = { '(': ')', '[': ']', '{': '}' };
const SATSORD = new Set(['const', 'let', 'var', 'return', 'if', 'for', 'while', 'function', 'throw', 'break', 'continue', 'switch', 'try', 'do', 'class']);
const KONTROLLORD = new Set(['if', 'while', 'for', 'switch', 'with', 'function', 'catch']);
const LISTANROP = new Set(['map', 'forEach', 'filter', 'flatMap', 'some', 'every', 'find', 'findIndex', 'findLast']);
const LITERALORD = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);
const ar = (x, t, v) => x && x.t === t && (v === undefined || x.v === v);
const op = (x, v) => ar(x, 'op', v);
const avslutarOperand = x => x && (x.t === 'tal' || x.t === 'str' || x.t === 'regex' || (x.t === 'namn' && !FORE_UTTRYCK.has(x.v))
    || (x.t === 'mall' && (x.v === 'hel' || x.v === 'svans')) || (x.t === 'op' && [')', ']', '}'].includes(x.v)));

function bygg(namn, src) {
    const tok = lexa(src);
    const n = tok.length;
    const par = new Int32Array(n).fill(-1);
    const block = new Int32Array(n).fill(-1);
    const oppen = new Int32Array(n).fill(-1);       // den innersta öppnade klammern eller mallen
    const mallar = new Map();                       // huvudets index → delarnas index
    const st = [], bst = [];
    for (let i = 0; i < n; i++) {
        const t = tok[i];
        block[i] = bst.length ? bst[bst.length - 1] : -1;
        oppen[i] = st.length ? st[st.length - 1] : -1;
        if (t.t === 'op' && OPPNA[t.v]) { st.push(i); if (t.v === '{') bst.push(i); }
        else if (t.t === 'op' && [')', ']', '}'].includes(t.v)) { const o = st.pop(); par[o] = i; par[i] = o; if (t.v === '}') bst.pop(); }
        else if (t.t === 'mall' && t.v === 'huvud') { st.push(i); mallar.set(i, [i]); }
        else if (t.t === 'mall' && t.v === 'mitt') mallar.get(st[st.length - 1]).push(i);
        else if (t.t === 'mall' && t.v === 'svans') { const o = st.pop(); mallar.get(o).push(i); par[o] = i; par[i] = o; }
        else if (t.t === 'mall' && t.v === 'hel') mallar.set(i, [i]);
    }
    const fil = { namn, src, tok, par, block, oppen, mallar, funktioner: [], dekl: [], tilldelningar: [], forekomster: new Map(), funkVidStart: new Map(), funkVidKropp: new Map() };
    fil.hoppa = i => (par[i] > i ? par[i] + 1 : i + 1);
    fil.slut = a => uttrycksSlut(fil, a);
    fil.text = (a, b) => src.slice(tok[a].s, tok[b - 1].e).replace(/\s+/g, ' ').trim();
    fil.rad = i => src.slice(0, tok[i].s).split('\n').length;
    fil.omfang = blk => (blk < 0 ? [0, n] : [blk, par[blk]]);
    analyseraStruktur(fil);
    return fil;
}

/** Var ett uttryck som börjar vid a slutar: vid , ; eller en stängande klammer på samma nivå, eller vid en ny sats på ny rad. */
function uttrycksSlut(fil, a) {
    const { tok } = fil;
    let j = a;
    while (j < tok.length) {
        const t = tok[j];
        if (op(t, ',') || op(t, ';') || op(t, ')') || op(t, ']') || op(t, '}') || (t.t === 'mall' && (t.v === 'mitt' || t.v === 'svans'))) return j;
        if (j > a && t.nyRad && t.t === 'namn' && SATSORD.has(t.v) && avslutarOperand(tok[j - 1])) return j;
        j = fil.hoppa(j);
    }
    return j;
}

/** Delar [a, b) på toppnivån vid tecknet sep. */
function delaArg(fil, a, b, sep = ',') {
    const delar = [];
    let s = a;
    for (let j = a; j < b;) {
        if (op(fil.tok[j], sep)) { delar.push([s, j]); s = j + 1; j++; continue; }
        j = fil.hoppa(j);
    }
    if (s < b) delar.push([s, b]);
    return delar;
}

/** Den innersta öppna klammern runt index i (hoppar över mallens delar). */
function oppenFor(fil, i) {
    const p = fil.oppen[i];
    return p >= 0 && fil.tok[p].t !== 'mall' ? p : -1;
}

/** Var en kedja (a.b(c)[d]) som slutar vid index j börjar. */
function kedjeStart(fil, j) {
    const { tok, par } = fil;
    for (;;) {
        const t = tok[j];
        if ((op(t, ')') || op(t, ']')) && par[j] >= 0) {
            const o = par[j];
            const f = tok[o - 1];
            if (op(t, ')') && (ar(f, 'namn') || op(f, ')') || op(f, ']'))) { j = o - 1; continue; }
            if (op(t, ']') && (ar(f, 'namn') || op(f, ')') || op(f, ']'))) { j = o - 1; continue; }
            return o;
        }
        if (t.t === 'mall' && t.v === 'svans') return par[j];
        if (ar(t, 'namn') || t.t === 'str' || t.t === 'tal' || (t.t === 'mall' && t.v === 'hel')) {
            if (op(tok[j - 1], '.') || op(tok[j - 1], '?.')) { j -= 2; continue; }
            if (ar(tok[j - 1], 'namn', 'new')) return j - 1;
            return j;
        }
        return j + 1;
    }
}

/**
 * Namnen i ett mönster ({ a, b: c, d = 1 } eller [a, b]) som öppnas vid o, med steget från värdet till namnet:
 * '.a' i ett objekt, '[i]' på plats i i en lista. Ett namn längre in, efter ... eller under en beräknad nyckel får steget null
 * och prövas mot hela värdet. Standardvärdet (d = 1) prövas för sig.
 */
function monsterNamn(fil, o) {
    const { tok, par } = fil;
    const objekt = op(tok[o], '{');
    const ut = [];
    for (const [i, [s, e]] of delaArg(fil, o + 1, par[o]).entries()) {
        const kolon = objekt && op(tok[s + 1], ':') ? s + 1 : -1;
        const m = kolon >= 0 ? kolon + 1 : s;
        if (ar(tok[m], 'namn') && (m + 1 === e || op(tok[m + 1], '='))) {
            const nyckel = kolon < 0 ? tok[m].v : (tok[s].t === 'namn' || tok[s].t === 'str' ? tok[s].v : null);
            ut.push({ namn: tok[m].v, idx: m, steg: objekt ? (nyckel === null ? null : `.${nyckel}`) : `[${i}]`, monsterStandard: op(tok[m + 1], '=') ? [m + 2, e] : null });
            continue;
        }
        // ...rest: resten av objektet (samma egenskaper) eller av listan (elementen, på andra platser).
        if (op(tok[s], '...') && ar(tok[s + 1], 'namn') && s + 2 === e) { ut.push({ namn: tok[s + 1].v, idx: s + 1, steg: '...', monsterStandard: null }); continue; }
        for (let x = s; x < e; x++) {
            if (ar(tok[x], 'namn') && !op(tok[x + 1], ':') && !op(tok[x - 1], '.') && (x + 1 === e || op(tok[x + 1], ',') || op(tok[x + 1], '}') || op(tok[x + 1], ']') || op(tok[x + 1], '='))) {
                ut.push({ namn: tok[x].v, idx: x, steg: null, monsterStandard: null });
            }
        }
    }
    return ut;
}

function paramsUr(fil, a, b, funk) {
    const { tok } = fil;
    return delaArg(fil, a, b).map(([s, e], pos) => {
        if (s + 1 === e && ar(tok[s], 'namn')) return [{ namn: tok[s].v, idx: s, pos, standard: null }];
        if (ar(tok[s], 'namn') && op(tok[s + 1], '=')) return [{ namn: tok[s].v, idx: s, pos, standard: [s + 2, e] }];
        if (op(tok[s], '{') || op(tok[s], '[')) return monsterNamn(fil, s).map(x => ({ ...x, pos, monster: true, standard: null }));
        // ...rest: namnen binds, men värdet går inte att följa.
        const ut = [];
        for (let j = s; j < e; j++) if (ar(tok[j], 'namn') && !op(tok[j + 1], ':') && !op(tok[j - 1], '.')) ut.push({ namn: tok[j].v, idx: j, pos, monster: true, standard: null });
        return ut;
    }).flat().map(p => ({ ...p, typ: 'param', funk }));
}

function analyseraStruktur(fil) {
    const { tok, par, block } = fil;
    const n = tok.length;
    const laggFunk = (start, pa, pb, kropp, namn) => {
        const funk = { fil, start, kropp, namn, params: [] };
        funk.params = paramsUr(fil, pa, pb, funk);
        fil.funktioner.push(funk);
        fil.funkVidStart.set(start, funk);
        if (kropp.typ === 'block') fil.funkVidKropp.set(kropp.a, funk);
        const scope = kropp.typ === 'block' ? [pa - 1, kropp.b] : [pa - 1, kropp.b];
        for (const p of funk.params) fil.dekl.push({ ...p, scope });
        return funk;
    };
    for (let k = 0; k < n; k++) {
        const t = tok[k];
        if (ar(t, 'namn', 'function')) {
            let j = k + 1;
            if (op(tok[j], '*')) j++;
            const namn = ar(tok[j], 'namn') ? tok[j].v : null;
            if (namn) j++;
            if (!op(tok[j], '(')) continue;
            const kb = par[j] + 1;
            const funk = laggFunk(k, j + 1, par[j], { typ: 'block', a: kb, b: par[kb] }, namn);
            const f = ar(tok[k - 1], 'namn', 'async') ? tok[k - 2] : tok[k - 1];
            if (namn && (!f || op(f, ';') || op(f, '}') || op(f, '{') || ar(f, 'namn', 'export'))) {
                fil.dekl.push({ namn, typ: 'funktion', idx: k + 1, funk, scope: fil.omfang(block[k]) });
            }
        } else if (op(t, '=>')) {
            const f = tok[k - 1];
            let start, pa, pb;
            if (ar(f, 'namn')) { start = k - 1; pa = k - 1; pb = k; }
            else if (op(f, ')')) { start = par[k - 1]; pa = start + 1; pb = k - 1; }
            else continue;
            if (ar(tok[start - 1], 'namn', 'async')) start--;
            const kropp = op(tok[k + 1], '{') ? { typ: 'block', a: k + 1, b: par[k + 1] } : { typ: 'uttryck', a: k + 1, b: uttrycksSlut(fil, k + 1) };
            laggFunk(start, pa, pb, kropp, null);
        } else if (op(t, ')') && op(tok[k + 1], '{')) {
            // Metod i ett objekt eller en klass, och catch (e) { … }.
            const o = par[k];
            const f = tok[o - 1];
            if (!ar(f, 'namn') || (KONTROLLORD.has(f.v) && f.v !== 'catch') || ar(tok[o - 2], 'namn', 'function')) continue;
            if (f.v !== 'catch' && !(op(tok[o - 2], ',') || op(tok[o - 2], '{') || op(tok[o - 2], '}') || op(tok[o - 2], ';') || ar(tok[o - 2], 'namn'))) continue;
            laggFunk(o - 1, o + 1, k, { typ: 'block', a: k + 1, b: par[k + 1] }, f.v === 'catch' ? null : f.v);
        } else if (ar(t, 'namn') && ['const', 'let', 'var'].includes(t.v)) {
            const scope = fil.omfang(block[k]);
            // for (const x of lista): x är ett element i listan; for (const k in objekt): en nyckel i objektet.
            const iFor = op(tok[k - 1], '(') && ar(tok[k - 2], 'namn', 'for');
            const loop = (d, j) => {
                if (iFor && (ar(tok[j], 'namn', 'of') || ar(tok[j], 'namn', 'in'))) d.forAv = { of: tok[j].v === 'of', varde: [j + 1, uttrycksSlut(fil, j + 1)] };
            };
            let j = k + 1;
            for (;;) {
                if (ar(tok[j], 'namn')) {
                    const namn = tok[j].v;
                    if (op(tok[j + 1], '=')) {
                        const e = uttrycksSlut(fil, j + 2);
                        fil.dekl.push({ namn, typ: t.v, idx: j, init: [j + 2, e], scope });
                        j = e;
                    } else {
                        const d = { namn, typ: t.v, idx: j, init: null, scope };
                        fil.dekl.push(d);
                        j++;
                        loop(d, j);
                    }
                } else if (op(tok[j], '{') || op(tok[j], '[')) {
                    const namnen = monsterNamn(fil, j).map(x => ({ ...x, typ: t.v, init: null, monster: true, scope }));
                    j = par[j] + 1;
                    // const { a } = X: a är X.a.
                    if (op(tok[j], '=')) { const e = uttrycksSlut(fil, j + 1); for (const d of namnen) d.monsterInit = [j + 1, e]; j = e; }
                    else for (const d of namnen) loop(d, j);
                    fil.dekl.push(...namnen);
                } else break;
                if (op(tok[j], ',')) { j++; continue; }
                break;
            }
        }
    }
    for (const d of fil.dekl) d.fil = fil;
    // En funktion som är värdet i const f = (…) => … heter f.
    for (const d of fil.dekl) {
        const f = d.init && fil.funkVidStart.get(d.init[0]);
        if (f && !f.namn) { f.namn = d.namn; f.dekl = d; }
        if (d.typ === 'funktion') d.funk.dekl = d;
    }
    // Ett återanrop som är första argumentet till .map(…) och liknande: parametrarna är listans element och index.
    for (const f of fil.funktioner) {
        const p = oppenFor(fil, f.start);
        if (p < 0 || !op(tok[p], '(')) continue;
        const pos = delaArg(fil, p + 1, par[p]).findIndex(([s, e]) => s === f.start);
        if (ar(tok[p - 1], 'namn') && (op(tok[p - 2], '.') || op(tok[p - 2], '?.'))) {
            const metod = tok[p - 1].v;
            if (pos === 0 && LISTANROP.has(metod)) f.listanrop = { metod, mottagare: [kedjeStart(fil, p - 3), p - 2] };
            // reduce: första parametern är startvärdet eller det förra returvärdet, alltså hela anropets värde.
            else if (pos === 0 && metod === 'reduce') f.listanrop = { metod, mottagare: [kedjeStart(fil, p - 3), p - 2], anrop: [kedjeStart(fil, p - 3), par[p] + 1] };
            else if (pos === 1 && metod === 'from' && ar(tok[p - 3], 'namn', 'Array')) {
                const forsta = delaArg(fil, p + 1, par[p])[0];
                f.listanrop = { metod, mottagare: forsta };
            }
        }
    }
    // Ändringar av ett namn: x = v, x.a[k].b = v, x.a.push(v), m.set(k, v) och liknande. Varje ändring sparas med
    // vägen dit (steg som '.a' och '[]'), värdena och de beräknade nycklarna.
    const deklIdx = new Set(fil.dekl.map(d => d.idx));
    const TILLDELNING = ['=', '+=', '||=', '??=', '&&='];
    for (let j = 0; j < n; j++) {
        const t = tok[j];
        if (!ar(t, 'namn') || op(tok[j - 1], '.') || op(tok[j - 1], '?.')) continue;
        if (!fil.forekomster.has(t.v)) fil.forekomster.set(t.v, []);
        fil.forekomster.get(t.v).push(j);
        if (deklIdx.has(j)) continue;
        const vag = [];
        const nycklar = [];
        let m = j + 1;
        for (;;) {
            if ((op(tok[m], '.') || op(tok[m], '?.')) && ar(tok[m + 1], 'namn')) {
                const metod = tok[m + 1].v;
                if (op(tok[m + 2], '(')) {
                    const args = delaArg(fil, m + 3, par[m + 2]);
                    const varden = { push: args, unshift: args, splice: args.slice(2), fill: args.slice(0, 1), set: args.slice(1) }[metod];
                    if (varden) fil.tilldelningar.push({ namn: t.v, idx: j, steg: [...vag, '[]'], varden, nycklar: metod === 'set' ? [...nycklar, ...args.slice(0, 1)] : nycklar });
                    break;
                }
                vag.push(`.${metod}`); m += 2; continue;
            }
            if (op(tok[m], '[') && par[m] > m) { vag.push(indexSteg(fil, m)); nycklar.push([m + 1, par[m]]); m = par[m] + 1; continue; }
            break;
        }
        if (op(tok[m]) && TILLDELNING.includes(tok[m].v)) fil.tilldelningar.push({ namn: t.v, idx: j, steg: vag, varden: [[m + 1, uttrycksSlut(fil, m + 1)]], nycklar });
    }
}

// ---- Bedömningen ----

const VERSALER = /^_?[A-Z][A-Z0-9_]*$/;
/** Ger ett tal, ett datum, ett sanningsvärde eller en data-URL (canvasens toDataURL) som text: säkert vad mottagaren än är. */
const TALMETODER = new Set(['toDataURL', 'toFixed', 'toPrecision', 'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString', 'getFullYear', 'getMonth',
    'getDate', 'getDay', 'getHours', 'getMinutes', 'getSeconds', 'getTime', 'indexOf', 'lastIndexOf', 'findIndex', 'includes', 'startsWith',
    'endsWith', 'test', 'some', 'every', 'localeCompare', 'charCodeAt', 'has', 'isInteger', 'isFinite', 'isNaN']);
const TALEGENSKAPER = new Set(['length', 'size']);
/** Strängmetoder vars resultat är säkert när mottagaren (och argumenten) är det. */
const STRANGMETODER = new Set(['trim', 'trimStart', 'trimEnd', 'toUpperCase', 'toLowerCase', 'toLocaleUpperCase', 'toLocaleLowerCase', 'slice',
    'substring', 'substr', 'padStart', 'padEnd', 'repeat', 'toString', 'normalize', 'charAt', 'at', 'concat']);
const LISTMETODER = new Set(['filter', 'slice', 'sort', 'reverse', 'flat', 'toSorted', 'toReversed']);
const GLOBALA_TAL = new Set(['Number', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'Boolean']);
/**
 * Egenskaper som i hela appen bär ett tal: antal, medianer, procent och inställningar som läsningen prövar som tal.
 * En egenskap med ett av namnen godkänns var den än står (p.n, d.organisation.antalAidxBas). Namnen är granskade mot
 * källan; ett namn som också används för text hör inte hit.
 */
const TALNAMN = Object.fromEntries([
    ['antal i en grupp eller ett urval, räknat ur lönefilen (length, filter, summor)',
        'n nKv nMa kvN maN maNKv maNMa tot count nKvAnalysed nMaAnalysed nPersoner nGrupperBada nEnkonade antalAr antalGrupper antalAid '
        + 'antalAidxBas antalOrd targetsCount prioCount lvCount egenCount klaraForra totaltForra klaraNu totaltNu personsCovered personsTotal '
        + 'groupsCovered groupsTotal utelamnade kvDomFunna ickeKvFunna kvDomMedNLessThanK kvUtanPoang gemensammaBas möjligaPar statHögre '
        + 'statLägreEllerLika internaPar externaPar basMedExternFallback leapfrog hHoga kiB'],
    ['en persons ålder och rad i lönefilen: tal ur extractMinimalRecord (06-uppgiftsminimering.js)', 'alder radnr'],
    ['lönemått i kronor, räknade med Stat eller lästa som tal (tolkaTal) ur ställningstagandet och jämförelsestatistiken',
        'median med p10 p90 medTot medKv medMa kvMedian maMedian refMedian diffKr gapKr costPerPerson annualGapTotal valueKv valueMa'],
    ['procent, andelar och index som räknas', 'gapPct diffPct maKvAndel priorityIndex'],
    ['inställningar som fälten, konfigurationsfilen och organisationspaketet prövar som tal (19-konfiguration.js, src/lib/organisationspaket.js)',
        'months avvikelse volym jamstalldhet kvinnoTrosholdPct minGapPct topN poangBandPct roundStep lonCap inactivityTimeoutMin inaktivitetMin '
        + 'atgardThreshold akutMinN bevakaThreshold analyseraThreshold kGrans'],
    ['år och minsta gruppstorlek: heltal som räknas eller som valideraArsbokslut prövar (src/lib/arsbokslut.js)', 'ar year k'],
].flatMap(([skal, namn]) => namn.split(' ').map(x => [x, skal])));

/**
 * Funktioner som alltid ger säker text eller färdig, escapad HTML, oavsett argument. Varje post är läst i källan.
 */
const VITLISTA = {
    svTal: 'tal i svenskt format med Intl.NumberFormat; "–" när värdet inte är ett ändligt tal (03-hjalpfunktioner.js)',
    kTroskel: 'tröskeln: state.kTroskel eller K_SKARM, ett heltal som sattKTroskel och paketläsningen prövar (06-k-troskel.js)',
    statGolv: 'golvet för statistik, ett heltal ur kTroskel (06-k-troskel.js)',
    personOrd: '"person" eller "personer" (src/lib/namn.js)',
    artikel: 'artikeln en/ett/den/det/de (src/lib/termer.js, artikel)',
    'Math.*': 'tal',
    'Number.*': 'tal eller sanningsvärde',
    'Date.now': 'tal',
    'Stat.*': 'median, kvantil och andra mått ur lönelistan: räknar på talen den får och ger tal (12-tillstand.js)',
    talformat: 'talformat i src/lib/figur.js: "–" eller ett tal med Intl.NumberFormat, med " kr" eller " %"',
};
/**
 * Funktioner som ger säker text när argumenten är säkra: de böjer eller fyller i det de får, utan att lägga till
 * något ur indata. Argumenten prövas i stället för funktionen.
 */
const GENOMSKINLIGA = {
    stor: 'stor begynnelsebokstav på texten (src/lib/termer.js, stor)',
    genitiv: 'texten med -s (src/lib/termer.js, genitiv)',
    adjektiv: 'adjektivet böjt efter termens genus (src/lib/termer.js, adjektiv)',
    termFras: 'termens ordform, med adjektiv och genitiv (src/lib/termer.js, termFras)',
    ordForAntal: 'termens en- eller plurala form (src/lib/termer.js, ordForAntal)',
    termText: 'mallen fylld med termerna; klamrar som inte är termer står kvar (09-termer.js, src/lib/termer.js fyllTermer)',
    String: 'värdet som text',
};

const ok = regel => ({ ok: true, regel, fel: [] });
const fel = (fil, a, b, skal) => ({ ok: false, regel: null, fel: [{ fil: fil.namn, rad: fil.rad(a), uttryck: fil.text(a, b), skal }] });
const alla = (regel, res) => {
    const f = res.filter(r => !r.ok);
    return f.length ? { ok: false, regel: null, fel: f.flatMap(r => r.fel) } : ok(regel);
};
/** Hur många anrop i rad vakten följer med argumenten bundna; djupare än så prövas parametern mot alla anrop. */
const MAX_DJUP = 8;
/** Tecknen som en escaping-kedja av .replace(…) måste ta hand om. */
const ESC_TECKEN = ['&', '<', '>', '"'];

// Läget säger vilken del av ett värde som hamnar i HTML: 'varde' (värdet som text, med allt det innehåller),
// 'lista' (elementen i en lista) eller en väg av steg: '.a' (egenskapen a) och '[]' (ett element i en lista eller
// ett värde i ett objekt). Läget '[] .yrke' är yrket på ett element. Så behöver bara den del som används vara säker.
/** x[2] ger steget '[2]', x[i] steget '[]'. */
const indexSteg = (fil, o) => (fil.par[o] === o + 2 && fil.tok[o + 1].t === 'tal' && /^\d+$/.test(fil.tok[o + 1].v) ? `[${fil.tok[o + 1].v}]` : '[]');
const arIndex = s => s === '[]' || /^\[\d+\]$/.test(s);
const steg = lage => (lage === 'varde' ? [] : lage === 'lista' ? ['[]'] : lage.split(' '));
const lageAv = s => (s.length === 0 ? 'varde' : s.length === 1 && s[0] === '[]' ? 'lista' : s.join(' '));
const efter = (forst, lage) => lageAv([forst, ...steg(lage)]);
/** Läget för värdet som ett namn ur ett mönster kommer ur: steget dit först; ...rest har samma egenskaper men andra platser. */
const genomSteg = (st, lage) => {
    if (st !== '...') return efter(st, lage);
    const s = steg(lage);
    return s[0] && arIndex(s[0]) ? efter('[]', lageAv(s.slice(1))) : lage;
};
/** Läget efter det första steget, om det är '[]' eller '[i]'; annars null. */
const iLista = lage => { const s = steg(lage); return s[0] && arIndex(s[0]) ? lageAv(s.slice(1)) : null; };
/** En egenskap ('.a') hos ett tal, en text eller en lista är aldrig data; men en metod som anropas ('.a ()') kan ge den. */
const arEgenskap = lage => lage !== 'varde' && lage !== 'lista' && lage.startsWith('.') && steg(lage)[1] !== '()';
/** Läget efter '()' (värdet som en funktion returnerar), om det är det första steget; annars null. */
const iAnrop = lage => { const s = steg(lage); return s[0] === '()' ? lageAv(s.slice(1)) : null; };
/**
 * Vad en ändring på vägen P betyder för en läsning i läget L: null om de inte möts; annars läget som värdet prövas
 * i, och om nycklarna i vägen också hamnar i det som läses (när hela det ändrade värdet läses).
 */
function tilldelningMot(P, lage) {
    const L = steg(lage);
    for (let i = 0; i < Math.min(P.length, L.length); i++) if (P[i] !== L[i] && P[i] !== '[]' && L[i] !== '[]') return null;
    if (P.length <= L.length) return { lage: lageAv(L.slice(P.length)), nycklar: false };
    return { lage: 'varde', nycklar: true };
}

function skapaBedomare(filer, undantag = []) {
    const globala = new Map();
    for (const fil of filer) for (const d of fil.dekl) if (arGlobal(d) && d.typ !== 'param' && !globala.has(d.namn)) globala.set(d.namn, d);
    const undantagMap = new Map(undantag.map(u => [`${u.fil}\u0000${u.uttryck.replace(/\s+/g, ' ').trim()}`, u]));
    const anvanda = new Set();
    const memo = new Map();
    const pagar = new Set();
    const kontexter = new Map();
    let nastaId = 1;

    // En prövning som når sig själv (rekursion) antas säker medan den pågår. Ett resultat som vilar på ett sådant
    // antagande sparas inte förrän den yttersta prövningen i kretsen är klar, så att ett fel längre ut inte göms.
    let antaganden = 0;
    const medMinne = (nyckel, f) => {
        if (memo.has(nyckel)) return memo.get(nyckel);
        if (pagar.has(nyckel)) { antaganden++; return ok('rekursion'); }
        const fore = antaganden;
        pagar.add(nyckel);
        const r = f();
        pagar.delete(nyckel);
        if (antaganden === fore || pagar.size === 0 || !r.ok) memo.set(nyckel, r);
        return r;
    };
    const undantagFor = (fil, a, b) => {
        const u = undantagMap.get(`${fil.namn}\u0000${fil.text(a, b)}`);
        if (u) anvanda.add(u);
        return u;
    };

    // ---- Kontexten: argumenten i de anrop som ledde hit ----
    // En bindning säger att funktionen funk anropades med args (i filen fil, i kontexten foralder). En parameter som
    // har en bindning prövas mot just det argumentet; utan bindning prövas den mot alla anrop av funktionen.
    const cid = ctx => (ctx ? ctx.id : 0);
    function bind(funk, fil, args, foralder, lista = null) {
        const djup = foralder ? foralder.djup + 1 : 1;
        if (djup > MAX_DJUP) return foralder;
        const nyckel = `${funk.fil.namn}:${funk.start}|${fil.namn}:${args ? args.map(x => x.join('-')).join(',') : ''}|${lista ? lista.join('-') : ''}|${cid(foralder)}`;
        if (!kontexter.has(nyckel)) kontexter.set(nyckel, { id: nastaId++, funk, fil, args, lista, foralder, djup });
        return kontexter.get(nyckel);
    }
    /** Bara bindningarna för funktioner som omsluter funk, så att samma funktion inte prövas om i onödan. */
    function beskar(ctx, funk) {
        const kedja = [];
        for (let c = ctx; c; c = c.foralder) if (c.funk.fil === funk.fil && c.funk.kropp.a <= funk.start && funk.start <= c.funk.kropp.b) kedja.unshift(c);
        let ut = null;
        for (const c of kedja) ut = bind(c.funk, c.fil, c.args, ut, c.lista);
        return ut;
    }

    /** Deklarationen som namnet vid index u syftar på: den innersta lokala, annars den globala. */
    function slaUpp(fil, u) {
        const namn = fil.tok[u].v;
        let bast = null;
        for (const d of fil.dekl) {
            if (d.namn !== namn || d.scope[0] > u || d.scope[1] < u) continue;
            if (arGlobal(d) && d.typ !== 'param') continue;
            if (!bast || d.scope[0] > bast.scope[0] || (d.scope[0] === bast.scope[0] && d.typ === 'param')) bast = d;
        }
        if (bast) return bast;
        return globala.get(namn) || null;
    }

    function prova(fil, a, b, lage = 'varde', ctx = null) {
        if (a >= b) return fel(fil, Math.max(0, a - 1), a, 'tomt uttryck');
        if (undantagFor(fil, a, b)) return ok('undantag');
        if (steg(lage).length > MAX_DJUP) return fel(fil, a, b, `vägen in i värdet är för lång (${lage})`);
        return medMinne(`${fil.namn}:${a}:${b}:${lage}:${cid(ctx)}`, () => provaInre(fil, a, b, lage, ctx));
    }

    function toppniva(fil, a, b, pred) {
        const ut = [];
        for (let j = a; j < b;) { if (pred(fil.tok[j], j)) ut.push(j); j = fil.hoppa(j); }
        return ut;
    }

    function provaInre(fil, a, b, lage, ctx) {
        const { tok, par } = fil;
        const p = (s, e, l = lage) => prova(fil, s, e, l, ctx);
        // Hela uttrycket inom parentes.
        if (op(tok[a], '(') && par[a] === b - 1) return p(a + 1, b - 1);
        const opIdx = v => toppniva(fil, a, b, t => op(t, v));
        if (opIdx(',').length) { const k = opIdx(','); return p(k[k.length - 1] + 1, b); }
        if (opIdx('=>').length) {
            const funk = fil.funkVidStart.get(a);
            if (funk && iAnrop(lage) !== null) return provaReturer(funk, iAnrop(lage), beskar(ctx, funk));
            return fel(fil, a, b, 'en funktion som värde');
        }
        if (ar(tok[a], 'namn', 'await')) return p(a + 1, b);
        for (const tilldelning of ['=', '+=', '||=', '??=']) { const k = opIdx(tilldelning); if (k.length) return p(k[0] + 1, b); }
        // Villkor: grenarna prövas, villkoret spelar ingen roll.
        const fraga = opIdx('?');
        if (fraga.length) {
            const q = fraga[0];
            let djup = 0, kolon = -1;
            for (let j = q + 1; j < b;) {
                if (op(tok[j], '?')) djup++;
                else if (op(tok[j], ':')) { if (djup === 0) { kolon = j; break; } djup--; }
                j = fil.hoppa(j);
            }
            if (kolon < 0) return fel(fil, a, b, 'ofullständigt villkor');
            // typeof x === 'number' ? x : … och typeof x !== 'number' ? … : x: grenen är ett tal.
            const talGren = (s0, e0, likhet) => {
                const t = fil.text(s0, e0);
                let [ca, cb] = [a, q];
                while (op(tok[ca], '(') && par[ca] === cb - 1) { ca++; cb--; }
                for (const j of toppniva(fil, ca, cb, x => ar(x, 'namn', 'typeof'))) {
                    const jf = toppniva(fil, j + 1, cb, x => op(x) && ['===', '!==', '==', '!='].includes(x.v))[0];
                    if (jf === undefined || tok[jf + 1]?.t !== 'str' || tok[jf + 1].v !== 'number' || fil.text(j + 1, jf) !== t) continue;
                    const lika = tok[jf].v === '===' || tok[jf].v === '==';
                    // Villkoret ska vara bara jämförelsen, eller kopplat med && (lika) respektive || (olika).
                    const koppling = lika ? '||' : '&&';
                    if (lika === likhet && !toppniva(fil, ca, cb, x => op(x, koppling)).length) return true;
                }
                return false;
            };
            return alla('villkor', [talGren(q + 1, kolon, true) ? ok('tal') : p(q + 1, kolon), talGren(kolon + 1, b, false) ? ok('tal') : p(kolon + 1, b)]);
        }
        for (const v of ['??', '||']) {
            const k = opIdx(v);
            if (k.length) return alla('villkor', [a, ...k.map(x => x + 1)].map((s, i, arr) => p(s, i + 1 < arr.length ? k[i] : b)));
        }
        // a && b ger a bara när a är falskt (tom text, 0, null): då är det bara b som kan bära text.
        const och = opIdx('&&');
        if (och.length) return p(och[och.length - 1] + 1, b);
        if (lage === 'varde') {
            if (toppniva(fil, a, b, t => op(t) && ['|', '^', '&', '<<', '>>', '>>>'].includes(t.v)).length) return ok('tal');
            if (toppniva(fil, a, b, t => (op(t) && ['==', '!=', '===', '!==', '<', '>', '<=', '>='].includes(t.v)) || ar(t, 'namn', 'instanceof') || ar(t, 'namn', 'in')).length) return ok('tal');
            // + och −: binära om tecknet före avslutar en operand.
            const plus = toppniva(fil, a, b, (t, j) => op(t, '+') && j > a && avslutarOperand(tok[j - 1]));
            const minus = toppniva(fil, a, b, (t, j) => op(t, '-') && j > a && avslutarOperand(tok[j - 1]));
            if (plus.length) return alla('sammanfogning', [a, ...plus.map(x => x + 1)].map((s, i, arr) => p(s, i + 1 < arr.length ? plus[i] : b)));
            if (minus.length) return ok('tal');
            if (toppniva(fil, a, b, t => op(t) && ['*', '/', '%', '**'].includes(t.v)).length) return ok('tal');
            if (op(tok[a]) && ['!', '-', '+', '~'].includes(tok[a].v)) return ok('tal');
            if (ar(tok[a], 'namn', 'typeof') || ar(tok[a], 'namn', 'void')) return ok('tal');
            if (op(tok[b - 1], '++') || op(tok[b - 1], '--') || op(tok[a], '++') || op(tok[a], '--')) return ok('tal');
        } else if (!arEgenskap(lage) && iAnrop(lage) === null) {
            // Ett element i en sammanfogad text är ett tecken ur någon av delarna; en uträkning ger ett tal.
            const plus = toppniva(fil, a, b, (t, j) => op(t, '+') && j > a && avslutarOperand(tok[j - 1]));
            if (plus.length) return alla('sammanfogning', [a, ...plus.map(x => x + 1)].map((s, i, arr) => p(s, i + 1 < arr.length ? plus[i] : b)));
            const RAKNA = ['|', '^', '&', '<<', '>>', '>>>', '==', '!=', '===', '!==', '<', '>', '<=', '>=', '*', '/', '%', '**'];
            const binar = toppniva(fil, a, b, (t, j) => (op(t) && RAKNA.includes(t.v)) || (op(t, '-') && j > a && avslutarOperand(tok[j - 1])));
            if (binar.length || (op(tok[a]) && ['!', '-', '+', '~'].includes(tok[a].v)) || ar(tok[a], 'namn', 'typeof')) return ok('tal');
        } else if (arEgenskap(lage)) {
            // En egenskap hos en uträkning eller en sammanfogad text.
            const BINARA = ['|', '^', '&', '<<', '>>', '>>>', '==', '!=', '===', '!==', '<', '>', '<=', '>=', '*', '/', '%', '**'];
            const binar = toppniva(fil, a, b, (t, j) => (op(t) && BINARA.includes(t.v)) || ((op(t, '+') || op(t, '-')) && j > a && avslutarOperand(tok[j - 1])));
            if (binar.length || (op(tok[a]) && ['!', '-', '+', '~'].includes(tok[a].v)) || ar(tok[a], 'namn', 'typeof')) return ok('tal');
        }
        return provaKedja(fil, a, b, lage, ctx);
    }

    /** En primär (namn, literal, mall, parentes, lista, objekt, new X(…)) följd av .namn, [i] och (…). */
    function delaKedja(fil, a, b) {
        const { tok } = fil;
        let j = a;
        const prim = { a, typ: null };
        const t = tok[a];
        if (ar(t, 'namn', 'new')) { prim.typ = 'new'; j = a + 1; while (j < b && (ar(tok[j], 'namn') || op(tok[j], '.'))) j++; if (op(tok[j], '(')) j = fil.hoppa(j); }
        else if (ar(t, 'namn')) { prim.typ = LITERALORD.has(t.v) ? 'literal' : 'namn'; j = a + 1; }
        else if (t.t === 'tal' || t.t === 'str' || t.t === 'regex') { prim.typ = 'literal'; j = a + 1; }
        else if (t.t === 'mall' && (t.v === 'hel' || t.v === 'huvud')) { prim.typ = 'mall'; j = fil.hoppa(a); }
        else if (op(t, '(')) { prim.typ = 'grupp'; j = fil.hoppa(a); }
        else if (op(t, '[')) { prim.typ = 'lista'; j = fil.hoppa(a); }
        else if (op(t, '{')) { prim.typ = 'objekt'; j = fil.hoppa(a); }
        else return null;
        prim.b = j;
        const acc = [];
        while (j < b) {
            if ((op(tok[j], '.') || op(tok[j], '?.')) && ar(tok[j + 1], 'namn')) { acc.push({ typ: 'medlem', namn: tok[j + 1].v, a: j, b: j + 2 }); j += 2; continue; }
            if (op(tok[j], '?.')) { j++; continue; }
            if (op(tok[j], '[')) { acc.push({ typ: 'index', a: j, b: fil.par[j] + 1 }); j = fil.par[j] + 1; continue; }
            if (op(tok[j], '(')) { acc.push({ typ: 'anrop', a: j, b: fil.par[j] + 1, args: delaArg(fil, j + 1, fil.par[j]) }); j = fil.par[j] + 1; continue; }
            return null;
        }
        return { prim, acc };
    }

    function punktvag(fil, prim, acc) {
        if (prim.typ !== 'namn' || !acc.every(x => x.typ === 'medlem')) return null;
        return [fil.tok[prim.a].v, ...acc.map(x => x.namn)].join('.');
    }
    const vitlistad = vag => vag && (VITLISTA[vag] || VITLISTA[vag.split('.')[0] + '.*']);

    /** En kedja av .replace(…) som byter &, <, > och " (som esc gör, i en eller flera regler). */
    function arEscKedja(fil, acc) {
        const tecken = new Set();
        for (let i = 1; i < acc.length; i++) {
            if (acc[i].typ !== 'anrop' || acc[i - 1].typ !== 'medlem' || !['replace', 'replaceAll'].includes(acc[i - 1].namn) || !acc[i].args[0]) continue;
            const t = fil.tok[acc[i].args[0][0]];
            if (t.t === 'str') tecken.add(t.v);
            if (t.t === 'regex') {
                const kropp = t.v.slice(1, t.v.lastIndexOf('/'));
                const klass = /^\[([^\]]*)\]$/.exec(kropp);
                for (const c of klass ? klass[1] : kropp) tecken.add(c);
            }
        }
        return ESC_TECKEN.every(c => tecken.has(c));
    }

    function provaKedja(fil, a, b, lage, ctx) {
        const { tok } = fil;
        const k = delaKedja(fil, a, b);
        if (!k) return fel(fil, a, b, 'okänt uttryck');
        const { prim, acc } = k;
        const p = (s, e, l = 'varde') => prova(fil, s, e, l, ctx);
        const mottagare = (n, l = lage) => (n === 0 ? provaPrimar(fil, prim, l, ctx) : p(a, acc[n - 1].b, l));
        if (acc.length === 0) return provaPrimar(fil, prim, lage, ctx);
        const sist = acc[acc.length - 1];
        const fore = acc[acc.length - 2];
        if (lage === 'varde' && sist.typ === 'medlem' && TALEGENSKAPER.has(sist.namn)) return ok('tal');
        // DOM:ens egen HTML: webbläsaren escapar text och attribut när den skriver ut den.
        if (lage === 'varde' && sist.typ === 'medlem' && (sist.namn === 'innerHTML' || sist.namn === 'outerHTML')) return ok('dom');
        if (sist.typ === 'anrop') {
            const args = sist.args;
            const arg = i => (args[i] ? p(args[i][0], args[i][1]) : ok('literal'));
            const inre = iLista(lage);
            if (fore && fore.typ === 'medlem') {
                const m = fore.namn;
                const n = acc.length - 2;
                const vag = punktvag(fil, prim, acc.slice(0, -1));
                if (arEgenskap(lage) && (TALMETODER.has(m) || STRANGMETODER.has(m) || ['join', 'replace', 'replaceAll', 'format'].includes(m))) return ok('tal');
                if (lage === 'varde' && TALMETODER.has(m)) return ok('tal');
                if (lage === 'varde' && m === 'format' && arIntl(fil, prim, acc.slice(0, n))) return ok('tal');
                if (lage === 'varde' && m === 'join') return alla('lista', [mottagare(n, 'lista'), arg(0)]);
                if (lage === 'varde' && (m === 'replace' || m === 'replaceAll')) {
                    if (arEscKedja(fil, acc)) return ok('esc');
                    return alla('strängmetod', [mottagare(n), args[1] ? provaFunkEllerVarde(fil, args[1], ctx) : ok('literal')]);
                }
                if (m === 'split' && inre !== null) return mottagare(n, 'varde');
                if (lage === 'varde' && STRANGMETODER.has(m)) return alla('strängmetod', [mottagare(n), ...args.map((_, i) => arg(i))]);
                if (m === 'map') {
                    if (arEgenskap(lage)) return ok('lista');
                    return args[0] ? provaFunktion(fil, args[0][0], args[0][1], inre ?? 'varde', ctx, [a, fore.a]) : fel(fil, a, b, 'map utan funktion');
                }
                if (m === 'flatMap') {
                    if (arEgenskap(lage)) return ok('lista');
                    return args[0] ? provaFunktion(fil, args[0][0], args[0][1], inre !== null ? lage : 'lista', ctx, [a, fore.a]) : fel(fil, a, b, 'flatMap utan funktion');
                }
                // f.apply(null, a) och f.call(null, …): det f returnerar, med parametrarna prövade mot alla anrop.
                if ((m === 'apply' || m === 'call') && n === 0 && prim.typ === 'namn') {
                    const d = slaUpp(fil, prim.a);
                    const funk = d && funktionFor(d);
                    if (funk) return provaReturer(funk, lage, beskar(ctx, funk));
                }
                // Promise.reject(…) ger inget värde; Promise.resolve(x) ger x.
                if (vag === 'Promise.reject') return ok('löfte');
                // löfte.finally(f) ger samma värde som löftet.
                if (m === 'finally') return mottagare(n, lage);
                if (vag === 'Promise.resolve') return args[0] ? p(args[0][0], args[0][1], lage) : ok('löfte');
                if (m === 'reduce') {
                    if (!args[0] || !args[1]) return fel(fil, a, b, 'reduce utan startvärde');
                    return alla('lista', [provaFunktion(fil, args[0][0], args[0][1], lage, ctx), p(args[1][0], args[1][1], lage)]);
                }
                // Ett element ur listan, eller ett värde ur en Map.
                if (['find', 'findLast', 'at', 'pop', 'shift', 'get'].includes(m)) return mottagare(n, efter('[]', lage));
                // lista.filter(x => … && KONSTANT.includes(x)): bara element som står i en konstant lista blir kvar.
                if (m === 'filter' && args[0] && arVitlistfilter(fil, args[0])) return ok('konstant');
                if ((inre !== null || lage === 'varde') && LISTMETODER.has(m)) return mottagare(n, lage);
                if (inre !== null && m === 'concat') return alla('lista', [mottagare(n, lage), ...args.map(([s, e]) => p(s, e, lage))]);
                if (inre !== null && ['Object.keys', 'Object.values', 'Object.entries'].includes(vag)) {
                    // Värdena prövas med resten av vägen; nycklar och par prövas som hela objektet, nycklarna med.
                    if (!args[0]) return fel(fil, a, b, 'tomt anrop');
                    if (vag === 'Object.values') return p(args[0][0], args[0][1], lage);
                    const par1 = steg(inre);
                    if (vag === 'Object.entries' && par1[0] === '[1]') return p(args[0][0], args[0][1], lageAv(['[]', ...par1.slice(1)]));
                    return p(args[0][0], args[0][1], 'varde');
                }
                if (inre !== null && ['values', 'keys', 'entries'].includes(m) && args.length === 0) return mottagare(n, m === 'values' ? lage : 'varde');
                if (inre !== null && vag === 'Array.from') {
                    if (args[1]) return provaFunktion(fil, args[1][0], args[1][1], inre, ctx);
                    return args[0] ? p(args[0][0], args[0][1], lage) : fel(fil, a, b, 'tomt anrop');
                }
                if (lage === 'varde' && vitlistad(vag)) return ok('vitlista');
                if (vag && GENOMSKINLIGA[vag]) return alla('genomskinlig', args.map((_, i) => arg(i)));
                // En metod i ett objekt som går att följa: x.f(…) är det x.f returnerar.
                if (!vag || !VERSALER.test(vag.split('.')[0])) return p(a, fore.a, lageAv([`.${m}`, '()', ...steg(lage)]));
            }
            if (acc.length === 1 && prim.typ === 'namn') {
                const namn = tok[prim.a].v;
                // encodeURIComponent kodar om &, <, > och " (som %26, %3C, %3E och %22).
                if (namn === 'esc' || namn === 'encodeURIComponent') return ok('esc');
                if (lage === 'varde' && VITLISTA[namn]) return ok('vitlista');
                if (lage === 'varde' && GLOBALA_TAL.has(namn)) return ok('tal');
                if (arEgenskap(lage) && (VITLISTA[namn] || GLOBALA_TAL.has(namn))) return ok('tal');
                if (GENOMSKINLIGA[namn]) return alla('genomskinlig', args.map((_, i) => arg(i)));
                const d = slaUpp(fil, prim.a);
                if (!d) return fel(fil, a, b, `okänd funktion ${namn}`);
                const funk = funktionFor(d);
                if (funk) return provaReturer(funk, lage, bind(funk, fil, args, beskar(ctx, funk)));
                // const f = a || (x => …): värdet anropas; funktionerna det kan vara prövas utan argumenten bundna.
                if ((d.typ === 'const' || d.typ === 'let') && d.init) return provaDekl(d, efter('()', lage), fil, prim.a, ctx);
                // En funktion som skickats som argument: varje anrop av den yttre funktionen ger en funktion som prövas.
                if (d.typ === 'param' && !d.monster) return provaParam(d, lage, fil, prim.a, ctx, true);
                return fel(fil, a, b, `${namn} är inte en funktion som går att följa`);
            }
            if (acc.length === 1 && prim.typ === 'grupp') {
                const funk = fil.funkVidStart.get(prim.a + 1);
                if (funk) return provaReturer(funk, lage, bind(funk, fil, args, beskar(ctx, funk)));
            }
            return fel(fil, a, b, `anrop som inte går att följa (${lage})`);
        }
        if (prim.typ === 'namn' && acc.every(x => x.typ !== 'anrop')) {
            const rot = tok[prim.a].v;
            if (rot === 'T') return ok('term');
            if (VERSALER.test(rot)) return ok('konstant');
        }
        if (lage === 'varde' && sist.typ === 'medlem' && TALNAMN[sist.namn]) return ok('talnamn');
        // x.a och x[i]: x prövas med vägen dit, så att bara den del som används behöver vara säker.
        return p(a, sist.a, efter(sist.typ === 'medlem' ? `.${sist.namn}` : indexSteg(fil, sist.a), lage));
    }

    /** new Intl.NumberFormat(…) eller ett namn som tilldelats en sådan. */
    function arIntl(fil, prim, acc, sedda = new Set()) {
        const { tok } = fil;
        if (prim.typ === 'new') return ar(tok[prim.a + 1], 'namn', 'Intl');
        if (prim.typ !== 'namn' || acc.length !== 0) return false;
        const d = slaUpp(fil, prim.a);
        if (!d || sedda.has(d)) return false;
        sedda.add(d);
        if (d.typ === 'const' && d.init) return ar(d.fil.tok[d.init[0]], 'namn', 'new') && ar(d.fil.tok[d.init[0] + 1], 'namn', 'Intl');
        if (d.typ === 'param' && !d.monster && d.funk.namn) {
            // En formaterare som skickas som argument: new Intl.NumberFormat(…) vid varje anrop.
            const anrop = anropAv(d.funk);
            return !!anrop && anrop.length > 0 && anrop.every(({ fil: af, args }) => {
                const a = args && args[d.pos];
                if (!a) return false;
                const k = delaKedja(af, a[0], a[1]);
                return !!k && arIntl(af, k.prim, k.acc, sedda);
            });
        }
        return false;
    }

    function arVitlistfilter(fil, [s, e]) {
        const funk = fil.funkVidStart.get(s);
        if (!funk || funk.kropp.typ !== 'uttryck' || funk.params.length !== 1 || funk.params[0].monster) return false;
        const x = funk.params[0].namn;
        const { tok } = fil;
        const [a, b] = [funk.kropp.a, funk.kropp.b];
        const och = [a, ...toppniva(fil, a, b, t => op(t, '&&')).map(j => j + 1)];
        return och.some((s0, i) => {
            const e0 = i + 1 < och.length ? och[i + 1] - 1 : b;
            return e0 - s0 === 6 && ar(tok[s0], 'namn') && VERSALER.test(tok[s0].v) && op(tok[s0 + 1], '.')
                && ['includes', 'has'].includes(tok[s0 + 2].v) && op(tok[s0 + 3], '(') && ar(tok[s0 + 4], 'namn', x) && op(tok[s0 + 5], ')');
        });
    }

    function provaFunkEllerVarde(fil, [s, e], ctx) {
        const funk = fil.funkVidStart.get(s);
        if (funk) return provaReturer(funk, 'varde', beskar(ctx, funk));
        return prova(fil, s, e, 'varde', ctx);
    }

    function provaPrimar(fil, prim, lage, ctx) {
        const { tok } = fil;
        const t = tok[prim.a];
        const p = (s, e, l = 'varde') => prova(fil, s, e, l, ctx);
        const inre = iLista(lage);
        // En literal är kod, vilken del av den som än används.
        if (prim.typ === 'literal') return ok('literal');
        if (prim.typ === 'grupp') return p(prim.a + 1, prim.b - 1, lage);
        if (prim.typ === 'mall') {
            if (arEgenskap(lage)) return ok('mall');
            return alla('mall', mallUttryck(fil, prim.a).map(([s, e]) => p(s, e)));
        }
        if (prim.typ === 'lista') {
            if (arEgenskap(lage)) return ok('lista');
            // Som text (varde) är listan elementen med komma emellan.
            const element = inre ?? 'varde';
            const spridda = inre !== null ? lageAv(['[]', ...steg(inre)]) : 'lista';
            const delar = delaArg(fil, prim.a + 1, prim.b - 1);
            const plats = /^\[(\d+)\]/.exec(lage);
            if (plats && !delar.some(([s]) => op(tok[s], '...'))) {
                const del = delar[Number(plats[1])];
                return del ? p(del[0], del[1], element) : ok('literal');
            }
            return alla('lista', delar.map(([s, e]) => (op(tok[s], '...') ? p(s + 1, e, spridda) : p(s, e, element))));
        }
        if (prim.typ === 'objekt') {
            // Som text (varde) prövas alla värden och beräknade nycklar, som om objektet lästes i sin helhet. Med
            // '.a' prövas värdet under nyckeln a (och det som sprids in), med '[]' alla värden.
            const s0 = steg(lage);
            const vald = s0[0] && s0[0].startsWith('.') ? s0[0].slice(1) : null;
            const rest = lage === 'varde' ? 'varde' : lageAv(s0.slice(1));
            return alla('objekt', delaArg(fil, prim.a + 1, prim.b - 1).map(([s, e]) => {
                if (op(tok[s], '...')) return p(s + 1, e, lage);
                const kolon = toppniva(fil, s, e, x => op(x, ':'))[0];
                if (kolon !== undefined && op(tok[s], '[')) return alla('objekt', [lage === 'varde' ? p(s + 1, kolon - 1) : ok('objekt'), p(kolon + 1, e, rest)]);
                const nyckel = tok[s].t === 'namn' || tok[s].t === 'str' || tok[s].t === 'tal' ? String(tok[s].v) : null;
                if (vald !== null && nyckel !== vald) return ok('objekt');
                if (kolon !== undefined) return p(kolon + 1, e, rest);
                if (fil.funkVidStart.get(s + 1) || op(tok[s + 1], '(')) {
                    const metod = fil.funkVidStart.get(s);
                    if (vald !== null && metod && iAnrop(rest) !== null) return provaReturer(metod, iAnrop(rest), beskar(ctx, metod));
                    return vald === null ? ok('objekt') : fel(fil, s, e, 'en metod som värde');
                }
                return p(s, e, rest);
            }));
        }
        if (prim.typ === 'new' && (ar(tok[prim.a + 1], 'namn', 'Set') || ar(tok[prim.a + 1], 'namn', 'Map')) && op(tok[prim.a + 2], '(')) {
            const args = delaArg(fil, prim.a + 3, fil.par[prim.a + 2]);
            if (!args[0] || arEgenskap(lage)) return ok('lista');
            // new Set(lista) har listans element; new Map(par) har värdena på plats 1 i paren. Nycklarna (och allt
            // som text) prövas som hela värdet.
            if (inre === null) return p(args[0][0], args[0][1], 'varde');
            return p(args[0][0], args[0][1], tok[prim.a + 1].v === 'Set' ? lage : lageAv(['[]', '[1]', ...steg(inre)]));
        }
        // new Promise((klar, fel) => { … klar(x) … }): löftet ger x. await och .then följs inte längre än så.
        if (prim.typ === 'new' && ar(tok[prim.a + 1], 'namn', 'Promise') && op(tok[prim.a + 2], '(')) {
            const funk = fil.funkVidStart.get(prim.a + 3);
            const klar = funk && funk.params[0] && !funk.params[0].monster ? funk.params[0].namn : null;
            if (!klar) return fel(fil, prim.a, prim.b, 'ett löfte som inte går att följa');
            const res = [];
            for (let j = funk.kropp.a; j < funk.kropp.b; j++) {
                if (!ar(tok[j], 'namn', klar) || op(tok[j - 1], '.')) continue;
                if (!op(tok[j + 1], '(')) return fel(fil, j, j + 1, 'löftets klar-funktion används som värde');
                const args = delaArg(fil, j + 2, fil.par[j + 1]);
                if (args[0]) res.push(p(args[0][0], args[0][1], lage));
            }
            return alla('löfte', res);
        }
        if (prim.typ !== 'namn') return fel(fil, prim.a, prim.b, 'okänt uttryck');
        const namn = t.v;
        if (VERSALER.test(namn)) return ok('konstant');
        const d = slaUpp(fil, prim.a);
        if (!d) return fel(fil, prim.a, prim.b, `globalt namn som inte går att följa (${lage})`);
        return provaDekl(d, lage, fil, prim.a, ctx);
    }
    function mallUttryck(fil, h) {
        const delar = fil.mallar.get(h);
        const ut = [];
        for (let i = 0; i + 1 < delar.length; i++) ut.push([delar[i] + 1, delar[i + 1]]);
        return ut;
    }

    function funktionFor(d) {
        if (d.typ === 'funktion') return d.funk;
        if (!((d.typ === 'const' || d.typ === 'let') && d.init)) return null;
        const f = d.fil.funkVidStart.get(d.init[0]);
        if (f) return f;
        // En lib-import: const termFras = __lib_termer.termFras pekar på funktionen i modulens IIFE (libSomKalla).
        const { tok } = d.fil;
        const [s, e] = d.init;
        if (e - s === 3 && ar(tok[s], 'namn') && tok[s].v.startsWith('__lib') && op(tok[s + 1], '.') && ar(tok[s + 2], 'namn')) {
            const modul = d.fil.dekl.find(m => m.namn === tok[s].v && m.init);
            const inre = modul && d.fil.dekl.find(m => m.typ === 'funktion' && m.namn === tok[s + 2].v && m.idx > modul.init[0] && m.idx < modul.init[1]);
            if (inre) { inre.funk.alias = d; return inre.funk; }
        }
        return null;
    }

    function provaReturer(funk, lage, ctx) {
        return medMinne(`retur:${funk.fil.namn}:${funk.start}:${lage}:${cid(ctx)}`, () => {
            const fil = funk.fil;
            if (funk.kropp.typ === 'uttryck') return prova(fil, funk.kropp.a, funk.kropp.b, lage, ctx);
            const res = [];
            for (let j = funk.kropp.a + 1; j < funk.kropp.b; j++) {
                if (!ar(fil.tok[j], 'namn', 'return')) continue;
                // Bara returerna i den här funktionen, inte i en inre.
                let blk = fil.block[j];
                while (blk >= 0 && blk !== funk.kropp.a && !fil.funkVidKropp.has(blk)) blk = fil.block[blk];
                if (blk !== funk.kropp.a) continue;
                const e = uttrycksSlut(fil, j + 1);
                if (e > j + 1) res.push(prova(fil, j + 1, e, lage, ctx));
            }
            return alla('funktion', res);
        });
    }

    /**
     * Funktionen som skickas som återanrop: en pilfunktion, function (…) {…} eller ett namn. `lista` är listan som
     * .map(…) går över, när återanropet är ett namn: då är första parametern ett element i den.
     */
    function provaFunktion(fil, s, e, lage, ctx, lista = null) {
        if (undantagFor(fil, s, e)) return ok('undantag');
        const funk = fil.funkVidStart.get(s);
        if (funk) return provaReturer(funk, lage, beskar(ctx, funk));
        if (s + 1 === e && ar(fil.tok[s], 'namn')) {
            if (fil.tok[s].v === 'esc') return ok('esc');
            if (lage === 'varde' && VITLISTA[fil.tok[s].v]) return ok('vitlista');
            const d = slaUpp(fil, s);
            if (d && d.typ === 'param' && !d.monster) return provaParam(d, lage, fil, s, ctx, true);
            const f = d && funktionFor(d);
            if (f) return provaReturer(f, lage, lista ? bind(f, fil, null, beskar(ctx, f), lista) : beskar(ctx, f));
        }
        return fel(fil, s, e, 'återanrop som inte går att följa');
    }

    function provaDekl(d, lage, fil, u, ctx) {
        const df = d.fil;
        if (d.typ === 'param') return provaParam(d, lage, fil, u, ctx);
        if (d.typ === 'funktion') {
            if (iAnrop(lage) !== null) return provaReturer(d.funk, iAnrop(lage), beskar(ctx, d.funk));
            return arEgenskap(lage) ? ok('funktion') : fel(fil, u, u + 1, 'en funktion som värde');
        }
        // Ett globalt namn som ändras i flera filer (state och liknande) följs inte; ett som bara ändras i sin egen
        // fil följs genom alla ändringar där.
        if (arGlobal(d) && d.typ !== 'const') return fel(fil, u, u + 1, `global variabel (${lage})`);
        const c = arGlobal(d) ? null : ctx;
        return medMinne(`dekl:${df.namn}:${d.idx}:${lage}:${cid(c)}`, () => {
            const res = [];
            // Ett namn ur ett mönster: värdet med steget dit ('.a' eller '[]'), eller hela värdet.
            const genom = l => (d.monster ? (d.steg ? genomSteg(d.steg, l) : 'varde') : l);
            if (d.monster && d.monsterStandard) res.push(prova(df, d.monsterStandard[0], d.monsterStandard[1], lage, c));
            if (d.forAv) res.push(prova(df, d.forAv.varde[0], d.forAv.varde[1], d.forAv.of ? efter('[]', genom(lage)) : 'varde', c));
            else if (d.monster && d.monsterInit) res.push(prova(df, d.monsterInit[0], d.monsterInit[1], genom(lage), c));
            else if (d.monster) return fel(fil, u, u + 1, 'namn ur ett mönster som inte går att följa');
            else if (d.init) res.push(prova(df, d.init[0], d.init[1], lage, c));
            else if (d.typ === 'const') return fel(fil, u, u + 1, 'konstant utan värde');
            // Ett globalt namn ändras i alla filer: varje ändring som träffar namnet prövas.
            const andringar = arGlobal(d) ? filer.flatMap(f => f.tilldelningar.map(t => [f, t])) : df.tilldelningar.map(t => [df, t]);
            for (const [tf, t] of andringar) {
                if (t.namn !== d.namn || (tf === df && (t.idx < d.scope[0] || t.idx > d.scope[1])) || slaUpp(tf, t.idx) !== d) continue;
                const m = tilldelningMot(t.steg, genom(lage));
                if (!m) continue;
                if (d.monster && t.steg.length === 0) return fel(tf, t.idx, t.idx + 1, 'namn ur ett mönster tilldelas');
                const tc = tf === df ? c : null;
                for (const [s, e] of t.varden) res.push(op(tf.tok[s], '...') ? prova(tf, s + 1, e, efter('[]', m.lage), tc) : prova(tf, s, e, m.lage, tc));
                if (m.nycklar) for (const [s, e] of t.nycklar) res.push(prova(tf, s, e, 'varde', tc));
            }
            return alla('variabel', res);
        });
    }

    /**
     * En parameter: i ett återanrop till .map(…) är index ett tal och elementet säkert om listan är det; med en
     * bindning prövas argumentet i anropet som ledde hit; annars måste funktionen bara anropas direkt, och argumentet
     * på samma plats vara säkert vid varje anrop. somFunktion: parametern anropas, och argumenten ska vara funktioner
     * vars return är säkra. En parameter ur ett mönster ({ a }) är argumentet med steget dit.
     */
    function provaParam(d, lage, fil, u, ctx, somFunktion = false) {
        if (d.monster) {
            if (!d.steg || somFunktion) return fel(fil, u, u + 1, 'parameter ur ett mönster som inte går att följa');
            const r = alla('parameter', [
                provaParam({ ...d, monster: false, steg: null, monsterStandard: null }, genomSteg(d.steg, lage), fil, u, ctx),
                d.monsterStandard ? prova(d.funk.fil, d.monsterStandard[0], d.monsterStandard[1], lage, ctx) : ok('literal'),
            ]);
            return r;
        }
        const funk = d.funk;
        const lista = funk.listanrop ? { fil: funk.fil, mottagare: funk.listanrop.mottagare, metod: funk.listanrop.metod, ctx: beskar(ctx, funk) } : null;
        let bunden = null;
        for (let c = ctx; c && !bunden; c = c.foralder) if (c.funk === funk) bunden = c;
        const listaFran = lista || (bunden && bunden.lista ? { fil: bunden.fil, mottagare: bunden.lista, metod: 'map', ctx: bunden.foralder } : null);
        if (listaFran && !somFunktion && listaFran.metod === 'reduce') {
            if (d.pos === 0) return prova(listaFran.fil, funk.listanrop.anrop[0], funk.listanrop.anrop[1], lage, listaFran.ctx);
            if (d.pos === 2) return ok('tal');
            if (d.pos === 1) return prova(listaFran.fil, listaFran.mottagare[0], listaFran.mottagare[1], efter('[]', lage), listaFran.ctx);
        }
        if (listaFran && !somFunktion) {
            if (d.pos === 1) return ok('tal');
            if (d.pos === 0) {
                const [s, e] = listaFran.mottagare;
                if (listaFran.metod === 'from' && op(listaFran.fil.tok[s], '{')) return ok('literal');   // Array.from({ length: n }, …)
                const r = prova(listaFran.fil, s, e, efter('[]', lage), listaFran.ctx);
                return r.ok ? ok('lista') : r;
            }
        }
        if (bunden && bunden.args) {
            const a = bunden.args[d.pos];
            if (bunden.args.slice(0, d.pos + 1).some(([s]) => op(bunden.fil.tok[s], '...'))) return fel(bunden.fil, bunden.args[0][0], bunden.args[0][1], 'spridda argument');
            if (a) return somFunktion ? provaFunktion(bunden.fil, a[0], a[1], lage, bunden.foralder) : prova(bunden.fil, a[0], a[1], lage, bunden.foralder);
            if (d.standard) return somFunktion ? provaFunktion(funk.fil, d.standard[0], d.standard[1], lage, null) : prova(funk.fil, d.standard[0], d.standard[1], lage, null);
            return ok('literal');   // undefined
        }
        if (!funk.namn) return fel(fil, u, u + 1, `parameter till en anonym funktion (${lage})`);
        return medMinne(`param:${funk.fil.namn}:${funk.start}:${d.pos}:${lage}:${somFunktion}`, () => {
            const anrop = anropAv(funk);
            if (!anrop) return fel(fil, u, u + 1, `parameter: ${funk.namn} används som värde`);
            const res = [];
            for (const { fil: af, args, lista } of anrop) {
                if (lista) {
                    if (somFunktion || d.pos > 1) res.push(fel(fil, u, u + 1, `parameter: ${funk.namn} är ett återanrop`));
                    else if (d.pos === 1) res.push(ok('tal'));
                    else {
                        res.push(prova(af, lista[0], lista[1], efter('[]', lage), null));
                    }
                    continue;
                }
                if (args.slice(0, d.pos + 1).some(([s]) => op(af.tok[s], '...'))) { res.push(fel(af, args[0][0], args[0][1], 'spridda argument')); continue; }
                const a = args[d.pos];
                if (a) res.push(somFunktion ? provaFunktion(af, a[0], a[1], lage, null) : prova(af, a[0], a[1], lage, null));
                else if (d.standard) res.push(somFunktion ? provaFunktion(funk.fil, d.standard[0], d.standard[1], lage, null) : prova(funk.fil, d.standard[0], d.standard[1], lage, null));
            }
            return alla('parameter', res);
        });
    }

    /** Alla anrop av en namngiven funktion; null om namnet också används som värde. */
    function anropAv(funk) {
        const ut = [];
        const namnen = [funk.dekl, funk.alias].filter(Boolean);
        if (!namnen.length) return null;
        for (const sok of namnen) {
            const df = sok.fil;
            for (const fil of arGlobal(sok) ? filer : [df]) {
                for (const j of fil.forekomster.get(sok.namn) || []) {
                    if (fil === df && j === sok.idx) continue;
                    const d = slaUpp(fil, j);
                    if (d !== sok) continue;
                    if (ar(fil.tok[j - 1], 'namn', 'typeof')) continue;
                    // Spegelns modul lämnar ut funktionen i sitt return-objekt ({ a, b }); aliaset prövas för sig.
                    if (funk.alias && sok === funk.dekl && (op(fil.tok[j - 1], '{') || op(fil.tok[j - 1], ',')) && (op(fil.tok[j + 1], ',') || op(fil.tok[j + 1], '}'))) continue;
                    if (op(fil.tok[j + 1], ':') && (op(fil.tok[j - 1], '{') || op(fil.tok[j - 1], ','))) continue;   // nyckel i ett objekt
                    if (op(fil.tok[j + 1], '(')) { ut.push({ fil, args: delaArg(fil, j + 2, fil.par[j + 1]) }); continue; }
                    // Funktionen som återanrop: lista.map(f) ger elementet och index.
                    const o = j - 1;
                    if (op(fil.tok[o], '(') && fil.par[o] === j + 1 && ar(fil.tok[o - 1], 'namn') && LISTANROP.has(fil.tok[o - 1].v) && (op(fil.tok[o - 2], '.') || op(fil.tok[o - 2], '?.'))) {
                        ut.push({ fil, lista: [kedjeStart(fil, o - 3), o - 2] });
                        continue;
                    }
                    return null;
                }
            }
        }
        return ut;
    }

    // Lib-importerna (const termFras = __lib_termer.termFras, se libSomKalla) kopplas till funktionerna innan något
    // prövas, så att anropen räknas som anrop av funktionen.
    for (const d of globala.values()) if (d.typ === 'const' && d.init && d.fil.tok[d.init[0]].v?.startsWith?.('__lib')) funktionFor(d);

    return { prova, anvanda, undantag };
}

const arGlobal = d => d.scope[0] === 0 && d.scope[1] === d.fil.tok.length;

const HTMLTAGG = /<\/?[A-Za-z][\w-]*[\s>/]|<!--/;

/** Allt vakten prövar i en fil: uttrycken i HTML-mallar, värdena till HTML-sänkorna och konkatenering med HTML. */
function provningar(fil) {
    const { tok, par } = fil;
    const ut = [];
    for (const [h, delar] of fil.mallar) {
        if (delar.length < 2) continue;
        const text = delar.map(i => tok[i].text).join('');
        if (!HTMLTAGG.test(text)) continue;
        for (let i = 0; i + 1 < delar.length; i++) ut.push({ typ: 'mall', a: delar[i] + 1, b: delar[i + 1] });
    }
    for (let j = 0; j < tok.length; j++) {
        const t = tok[j];
        if (op(t, '.') && ar(tok[j + 1], 'namn') && ['innerHTML', 'outerHTML'].includes(tok[j + 1].v) && (op(tok[j + 2], '=') || op(tok[j + 2], '+='))) {
            ut.push({ typ: 'sänka', a: j + 3, b: uttrycksSlut(fil, j + 3) });
        } else if (ar(t, 'namn', 'insertAdjacentHTML') && op(tok[j + 1], '(')) {
            const args = delaArg(fil, j + 2, par[j + 1]);
            if (args[1]) ut.push({ typ: 'sänka', a: args[1][0], b: args[1][1] });
        } else if (ar(t, 'namn', 'document') && op(tok[j + 1], '.') && ar(tok[j + 2], 'namn') && ['write', 'writeln'].includes(tok[j + 2].v) && op(tok[j + 3], '(')) {
            for (const [s, e] of delaArg(fil, j + 4, par[j + 3])) ut.push({ typ: 'sänka', a: s, b: e });
        } else if (op(t, '.') && ar(tok[j + 1], 'namn') && ['write', 'writeln'].includes(tok[j + 1].v) && ar(tok[j - 1], 'namn', 'document') === false
            && op(tok[j - 1], ')') === false && ar(tok[j - 2], 'op', '.') && ar(tok[j - 1], 'namn', 'document')) {
            // w.document.write(…) fångas ovan via namnet document.
        }
    }
    // Beräkningsbevisen (_evidenceFor…): intro, formula och footer skrivs som HTML i bevisrutan, liksom value på en
    // rad med isHtml: true (_openEvidenceModal i 27-berakningsbevis.js). De prövas där de byggs.
    for (const f of fil.funktioner.filter(f => f.namn && f.namn.startsWith('_evidenceFor') && f.kropp.typ === 'block')) {
        for (let j = f.kropp.a; j < f.kropp.b; j++) {
            if (!ar(tok[j], 'namn') || !op(tok[j + 1], ':') || !(op(tok[j - 1], '{') || op(tok[j - 1], ','))) continue;
            const o = oppenFor(fil, j);
            const isHtml = o >= 0 && delaArg(fil, o + 1, par[o]).some(([s, e]) => e - s === 3 && ar(tok[s], 'namn', 'isHtml') && ar(tok[s + 2], 'namn', 'true'));
            if (['intro', 'formula', 'footer'].includes(tok[j].v) || (tok[j].v === 'value' && isHtml)) ut.push({ typ: 'bevis', a: j + 2, b: uttrycksSlut(fil, j + 2) });
        }
    }
    // Konkatenering: en strängliteral med en HTML-tagg i en kedja med + på samma nivå.
    const GRANS = new Set([',', ';', '(', '[', '{', '=', '+=', '?', ':', '=>', '&&', '||', '??', '||=', '??=']);
    const sedda = new Set();
    for (let i = 0; i < tok.length; i++) {
        if (tok[i].t !== 'str' || !HTMLTAGG.test(tok[i].v)) continue;
        let a = i;
        for (let j = i - 1; j >= 0;) {
            const t = tok[j];
            if ((op(t) && [')', ']', '}'].includes(t.v)) || (t.t === 'mall' && t.v === 'svans')) { a = par[j]; j = par[j] - 1; continue; }
            if ((op(t) && GRANS.has(t.v)) || ar(t, 'namn', 'return') || ar(t, 'namn', 'case') || (t.t === 'mall' && (t.v === 'huvud' || t.v === 'mitt'))) break;
            a = j; j--;
        }
        const b = uttrycksSlutKedja(fil, i, GRANS);
        if (sedda.has(a)) continue;
        let harPlus = false;
        for (let j = a; j < b;) { if (op(tok[j], '+') && j > a && avslutarOperand(tok[j - 1])) harPlus = true; j = fil.hoppa(j); }
        if (!harPlus) continue;
        sedda.add(a);
        ut.push({ typ: 'konkatenering', a, b });
    }
    return ut;
}

function uttrycksSlutKedja(fil, i, grans) {
    const { tok } = fil;
    let j = i;
    while (j < tok.length) {
        const t = tok[j];
        if ((op(t) && ((grans.has(t.v) && !OPPNA[t.v]) || [')', ']', '}'].includes(t.v))) || (t.t === 'mall' && (t.v === 'mitt' || t.v === 'svans'))) return j;
        if (j > i && t.nyRad && t.t === 'namn' && SATSORD.has(t.v) && avslutarOperand(tok[j - 1])) return j;
        j = fil.hoppa(j);
    }
    return j;
}

/** Kör vakten över källorna: [{ namn, src, prova? }]. Spegeln (prova: false) läses bara för uppslag. */
function granska(kallor, undantag = []) {
    const filer = kallor.map(k => Object.assign(bygg(k.namn, k.src), { provas: k.prova !== false }));
    const bed = skapaBedomare(filer, undantag);
    const resultat = [];
    for (const fil of filer.filter(f => f.provas)) {
        const sedda = new Set();
        for (const p of provningar(fil)) {
            const nyckel = `${p.a}:${p.b}`;
            if (sedda.has(nyckel)) continue;
            sedda.add(nyckel);
            resultat.push({ ...p, fil: fil.namn, rad: fil.rad(p.a), text: fil.text(p.a, p.b).slice(0, 80), ...bed.prova(fil, p.a, p.b) });
        }
    }
    const fynd = new Map();
    for (const r of resultat) for (const f of r.fel) fynd.set(`${f.fil}:${f.rad}:${f.uttryck}`, f);
    return { resultat, fynd: [...fynd.values()], oanvanda: undantag.filter(u => !bed.anvanda.has(u)) };
}

/**
 * src/lib/ som en källa vakten kan läsa: varje modul i en IIFE (`const __lib_<modul> = (() => { … })()`) med sina
 * importer som alias inuti, och appens importer ur lib (`import { x as y } from '../lib/m.js'`) som globala alias
 * (`const y = __lib_m.x;`). Vakten känner inte ES-moduler; så når den lib-funktionerna som appen anropar, utan att
 * lib:s privata namn blir globala.
 * @param {string} libDir
 * @param {string[]} appTexter
 */
function libSomKalla(libDir, appTexter) {
    const IMPORT = /^import\s*\{([^}]*)\}\s*from\s*'(?:\.\/|\.\.\/lib\/)([\w.-]+)\.js';?\s*$/gm;
    const ns = fil => `__lib_${fil.replace(/\W/g, '_')}`;
    const alias = text => [...text.matchAll(IMPORT)].flatMap(m => m[1].split(',').map(b => b.trim()).filter(Boolean)
        .map(b => { const [ex, lok = ex] = b.split(/\s+as\s+/); return `const ${lok} = ${ns(m[2])}.${ex};`; }));
    const moduler = readdirSync(libDir).filter(f => f.endsWith('.js')).sort().map(f => {
        const text = readFileSync(join(libDir, f), 'utf8');
        const kropp = text.replace(IMPORT, '').replace(/^export\s+(?=(async\s+)?function\b|const\b|let\b|class\b)/gm, '');
        return `const ${ns(f.slice(0, -3))} = (() => {\n${alias(text).join('\n')}\n${kropp}\n})();`;
    });
    return [...moduler, ...new Set(appTexter.flatMap(t => alias(t.split('\n').filter(r => r.includes("'../lib/")).join('\n'))))].join('\n');
}

export { granska, lexa, libSomKalla };
